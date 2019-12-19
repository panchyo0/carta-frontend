import {Subject} from "rxjs";
import {action, computed, observable} from "mobx";
import LRUCache from "mnemonist/lru-cache";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";
import {copyToFP32Texture, createFP32Texture} from "../utilities";

export interface RasterTile {
    data: Float32Array;
    width: number;
    height: number;
    textureCoordinate: number;
}

export interface CompressedTile {
    tile: CARTA.ITileData;
    compressionQuality: number;
}

export const TEXTURE_SIZE = 4096;
export const TILE_SIZE = 256;
export const MAX_TEXTURES = 8;

export class TileService {
    private readonly backendService: BackendService;
    private readonly cachedTiles: LRUCache<number, RasterTile>;
    private readonly lruCapacitySystem: number;
    private readonly cacheMapCompressedTiles: Map<number, LRUCache<number, CompressedTile>>;
    private readonly pendingRequests: Map<number, boolean>;
    private readonly pendingDecompressions: Map<number, boolean>;
    private readonly channelMap: Map<number, { channel: number, stokes: number }>;
    private currentFileId: number;
    private readonly tileStream: Subject<number>;
    private readonly textureArray: Array<WebGLTexture>;
    private glContext: WebGLRenderingContext;
    private textureCoordinateQueue: Array<number>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;
    private pendingSynchronisedTiles: Array<number>;
    private receivedSynchronisedTiles: Array<{ coordinate: number, tile: RasterTile }>;

    @observable remainingTiles: number;

    @computed get waitingForSync() {
        return this.pendingSynchronisedTiles && this.pendingSynchronisedTiles.length > 0;
    }

    public GetTileStream() {
        return this.tileStream;
    }

    constructor(backendService: BackendService, lruCapacityGPU: number = 512, lruCapacitySystem: number = 4096) {
        this.backendService = backendService;
        this.channelMap = new Map<number, { channel: number, stokes: number }>();

        // L1 cache: on GPU
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = Math.min(Math.ceil(lruCapacityGPU / numTilesPerTexture), MAX_TEXTURES);
        lruCapacityGPU = numTextures * numTilesPerTexture;
        console.log(`lruGPU capacity rounded to : ${lruCapacityGPU}`);

        this.textureArray = new Array<WebGLTexture>(numTextures);
        this.resetCoordinateQueue();

        this.cachedTiles = new LRUCache<number, RasterTile>(Int32Array, null, lruCapacityGPU);
        this.pendingRequests = new Map<number, boolean>();

        // L2 cache: compressed tiles on system memory
        this.lruCapacitySystem = lruCapacitySystem;
        this.cacheMapCompressedTiles = new Map<number, LRUCache<number, CompressedTile>>();
        this.pendingDecompressions = new Map<number, boolean>();

        this.compressionRequestCounter = 0;
        this.remainingTiles = 0;

        this.tileStream = new Subject<number>();
        this.backendService.getRasterTileStream().subscribe(this.handleStreamedTiles);

        const ZFPWorker = require("worker-loader!zfp_wrapper");
        this.workers = new Array<Worker>(Math.min(navigator.hardwareConcurrency || 4, 4));
        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i] = new ZFPWorker();
            this.workers[i].onmessage = (event: MessageEvent) => {
                if (event.data[0] === "ready") {
                    console.log(`Tile Worker ${i} ready`);
                } else if (event.data[0] === "decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2];
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    this.updateStream(eventArgs.fileId, resultArray, eventArgs.width, eventArgs.subsetHeight, eventArgs.layer, eventArgs.tileCoordinate);
                }
            };
        }
    }

    private resetCoordinateQueue() {
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = this.textureArray.length;
        const totalTiles = numTextures * numTilesPerTexture;
        this.textureCoordinateQueue = new Array<number>(totalTiles);

        for (let i = 0; i < totalTiles; i++) {
            this.textureCoordinateQueue[i] = totalTiles - 1 - i;
        }
    }

    private getCompressedCache(fileId: number) {
        const cache = this.cacheMapCompressedTiles.get(fileId);
        if (cache) {
            return cache;
        } else {
            const newCache = new LRUCache<number, CompressedTile>(Int32Array, null, this.lruCapacitySystem);
            this.cacheMapCompressedTiles.set(fileId, newCache);
            return newCache;
        }
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, stokes: number, peek: boolean = false) {
        if (peek) {
            return this.cachedTiles.peek(tileCoordinateEncoded);
        }
        return this.cachedTiles.get(tileCoordinateEncoded);
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number) {
        let channelsChanged = false;
        let fileChanged = this.currentFileId !== fileId;
        const currentChannels = this.channelMap.get(fileId);
        if (currentChannels) {
            channelsChanged = (channel !== currentChannels.channel || stokes !== currentChannels.stokes);
        } else {
            channelsChanged = true;
        }

        if (fileChanged) {
            this.currentFileId = fileId;
            this.pendingSynchronisedTiles = tiles.map(tile => tile.encode());
            this.receivedSynchronisedTiles = [];
            this.clearRequestQueue();
        }

        if (channelsChanged) {
            this.pendingSynchronisedTiles = tiles.map(tile => tile.encode());
            this.receivedSynchronisedTiles = [];
            this.clearRequestQueue();
            this.channelMap.set(fileId, {channel, stokes});
            this.clearCompressedCache(fileId);
        }

        const newRequests = new Array<TileCoordinate>();
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const tileCached = !(channelsChanged || fileChanged) && (this.cachedTiles.has(encodedCoordinate));
            if (!tileCached && !this.pendingRequests.has(encodedCoordinate)) {
                const compressedTile = !channelsChanged && this.getCompressedCache(fileId).get(encodedCoordinate);
                if (compressedTile && !this.pendingDecompressions.has(encodedCoordinate)) {
                    // Load from L2 cache instead
                    this.asyncDecompressTile(fileId, compressedTile.tile, compressedTile.compressionQuality, encodedCoordinate);
                } else if (!compressedTile) {
                    // Request from backend
                    this.pendingRequests.set(encodedCoordinate, true);
                    this.updateRemainingTileCount();
                    newRequests.push(tile);
                }
            }
        }

        if (newRequests.length) {
            // sort by distance to midpoint and encode (remove fileId from tile coordinate
            const sortedRequests = newRequests.sort((a, b) => {
                const aX = focusPoint.x - a.x;
                const aY = focusPoint.y - a.y;
                const bX = focusPoint.x - b.x;
                const bY = focusPoint.y - b.y;
                return (aX * aX + aY * aY) - (bX * bX + bY * bY);
            }).map(tile => tile.encode() % (2 ** 32));
            if (channelsChanged) {
                this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedRequests});
            } else {
                this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
        }
    }

    clearGPUCache() {
        this.cachedTiles.forEach(this.clearTile);
        this.cachedTiles.clear();
    }

    clearCompressedCache(fileId: number) {
        if (fileId === -1) {
            this.cacheMapCompressedTiles.clear();
        } else {
            this.cacheMapCompressedTiles.delete(fileId);
        }
    }

    clearRequestQueue() {
        this.pendingRequests.clear();
        this.updateRemainingTileCount();
    }

    setContext(gl: WebGLRenderingContext) {
        this.glContext = gl;
        const textureSizeMb = TEXTURE_SIZE * TEXTURE_SIZE * 4 / 1024 / 1024;
        console.log(`Creating ${this.textureArray.length} tile textures of size ${textureSizeMb} MB each (${textureSizeMb * this.textureArray.length} MB total)`);
        for (let i = 0; i < this.textureArray.length; i++) {
            this.textureArray[i] = createFP32Texture(gl, TEXTURE_SIZE, TEXTURE_SIZE, WebGLRenderingContext.TEXTURE0);
        }
    }

    clearContext() {
        if (this.glContext) {
            console.log(`Deleting ${this.textureArray.length} tile textures`);
            for (let i = 0; i < this.textureArray.length; i++) {
                this.glContext.deleteTexture(this.textureArray[i]);
            }
            this.glContext = null;
        }
        // Clear GPU cache, but keep compressed cache, as this will be used to recreate GPU resources
        this.clearGPUCache();
        this.resetCoordinateQueue();
    }

    uploadTileToGPU(tile: RasterTile) {
        if (this.glContext) {
            const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
            const localOffset = tile.textureCoordinate % numTilesPerTexture;
            const textureIndex = Math.floor((tile.textureCoordinate - localOffset) / numTilesPerTexture);
            const tilesPerRow = TEXTURE_SIZE / TILE_SIZE;
            const xOffset = (localOffset % tilesPerRow) * TILE_SIZE;
            const yOffset = Math.floor(localOffset / tilesPerRow) * TILE_SIZE;
            copyToFP32Texture(this.glContext, this.textureArray[textureIndex], tile.data, WebGLRenderingContext.TEXTURE0, tile.width, tile.height, xOffset, yOffset);
        }
    }

    getTileTextureParameters(tile: RasterTile) {
        if (this.glContext) {
            const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
            const localOffset = tile.textureCoordinate % numTilesPerTexture;
            const textureIndex = Math.floor((tile.textureCoordinate - localOffset) / numTilesPerTexture);
            const tilesPerRow = TEXTURE_SIZE / TILE_SIZE;
            const xOffset = (localOffset % tilesPerRow) * TILE_SIZE;
            const yOffset = Math.floor(localOffset / tilesPerRow) * TILE_SIZE;
            return {
                texture: this.textureArray[textureIndex],
                offset: {x: xOffset, y: yOffset}
            };
        } else {
            return null;
        }
    }

    @action updateRemainingTileCount = () => {
        this.remainingTiles = this.pendingRequests.size;
    };

    private clearTile = (tile: RasterTile, key: number) => {
        if (tile.data) {
            delete tile.data;
        }
        this.textureCoordinateQueue.push(tile.textureCoordinate);
    };

    private handleStreamedTiles = (tileMessage: CARTA.IRasterTileData) => {
        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const currentChannels = this.channelMap.get(tileMessage.fileId);
        // Ignore stale tiles that don't match the currently required tiles
        if (!currentChannels || currentChannels.channel !== tileMessage.channel || currentChannels.stokes !== tileMessage.stokes || this.currentFileId !== tileMessage.fileId) {
            return;
        }

        for (let tile of tileMessage.tiles) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x, tile.y, tile.layer, tileMessage.fileId);
            // Remove from the requested tile map
            if (this.pendingRequests.has(encodedCoordinate)) {
                this.pendingRequests.delete(encodedCoordinate);
                this.updateRemainingTileCount();

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength));
                    this.updateStream(tileMessage.fileId, decompressedData, tile.width, tile.height, tile.layer, encodedCoordinate);
                } else {
                    this.getCompressedCache(tileMessage.fileId).set(encodedCoordinate, {tile, compressionQuality: tileMessage.compressionQuality});
                    this.asyncDecompressTile(tileMessage.fileId, tile, tileMessage.compressionQuality, encodedCoordinate);
                }
            }
        }
    };

    private asyncDecompressTile(fileId: number, tile: CARTA.ITileData, precision: number, tileCoordinate: number) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array(tile.nanEncodings.slice(0).buffer);
        let compressedView = new Uint8Array(tile.width * tile.height * 4);
        compressedView.set(compressedArray);
        this.pendingDecompressions.set(tileCoordinate, true);
        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, {
                fileId,
                width: tile.width,
                subsetHeight: tile.height,
                subsetLength: compressedArray.byteLength,
                compression: precision,
                nanEncodings: nanEncodings32,
                tileCoordinate,
                layer: tile.layer,
                requestId: this.compressionRequestCounter
            }],
            [compressedView.buffer, nanEncodings32.buffer]);
        this.compressionRequestCounter++;
    }

    private updateStream(fileId: number, decompressedData: Float32Array, width: number, height: number, layer: number, encodedCoordinate: number) {
        // If there are pending tiles to be synchronized, don't send tiles one-by-one
        if (this.pendingSynchronisedTiles && this.pendingSynchronisedTiles.length) {
            // remove coordinate from pending list
            this.pendingSynchronisedTiles = this.pendingSynchronisedTiles.filter(v => v !== encodedCoordinate);
            const nextTile: RasterTile = {
                width,
                height,
                textureCoordinate: -1,
                data: decompressedData,
            };
            if (!this.receivedSynchronisedTiles) {
                this.receivedSynchronisedTiles = [];
            }
            this.receivedSynchronisedTiles.push({coordinate: encodedCoordinate, tile: nextTile});
            this.pendingDecompressions.delete(encodedCoordinate);

            // If all tiles are in place, add them to the LRU and fire the stream observable
            if (!this.pendingSynchronisedTiles.length) {
                const numSynchronisedTiles = this.receivedSynchronisedTiles.length;
                this.clearGPUCache();
                this.resetCoordinateQueue();

                for (const tilePair of this.receivedSynchronisedTiles) {
                    tilePair.tile.textureCoordinate = this.textureCoordinateQueue.pop();
                    const oldValue = this.cachedTiles.setpop(tilePair.coordinate, tilePair.tile);
                    if (oldValue) {
                        this.clearTile(oldValue.value, oldValue.key);
                    }
                }
                this.receivedSynchronisedTiles = [];
                this.tileStream.next(numSynchronisedTiles);
            }
        } else {
            // Handle single tile, no sync required
            const textureCoordinate = this.textureCoordinateQueue.pop();
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate,
                data: decompressedData,
            };
            const oldValue = this.cachedTiles.setpop(encodedCoordinate, rasterTile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            this.pendingDecompressions.delete(encodedCoordinate);
            this.tileStream.next(1);
        }
    }
}