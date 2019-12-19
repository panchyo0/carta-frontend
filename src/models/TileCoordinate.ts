export const TILE_COORDINATE_FILE_ID_OFFSET = (2 ** 32);
export class TileCoordinate {
    layer: number;
    x: number;
    y: number;
    fileId: number;

    constructor(x: number, y: number, layer: number, fileId: number) {
        this.x = x;
        this.y = y;
        this.layer = layer;
        this.fileId = fileId;
    }

    public encode(): number {
        return TileCoordinate.EncodeCoordinate(this);
    }

    public static EncodeCoordinate(coordinate: { x: number, y: number, layer: number, fileId: number }): number {
        if (!coordinate) {
            return -1;
        }
        return TileCoordinate.Encode(coordinate.x, coordinate.y, coordinate.layer, coordinate.fileId);
    }

    // Encoding a tile combines x, y and layer coordinates into a single number. This makes it more efficient
    // to transfer a list of tiles to the backend, but also simplifies using the coordinate as a map key.
    // 12 bits are used for each of the x and y coordinates (range of 0 - 4096), 7 bits for the layer.
    // The layer is limited to a range of 0 - 12, due to the range of the x and y coordinates
    //
    // Due to javascript's use of 64-bit floating-point numbers (53-bit mantissa), bitwise operations cannot be
    // performed on numbers larger than 2^32. Therefore, when encoding the file ID, we use ordinary floating point
    // arithmetic.
    public static Encode(x: number, y: number, layer: number, fileId: number): number {
        const layerWidth = 1 << layer;
        // check bounds
        if (x < 0 || y < 0 || layer < 0 || layer > 12 || x >= layerWidth || y >= layerWidth || fileId < 0) {
            return -1;
        }

        // encode using bitwise operators. This is equivalent to the tileId calculation used on the backend        //
        const tileId = ((layer << 24) | (y << 12) | x);
        // Offset by 2^32 multiplied by the fileId to ensure unique tileIds across files
        return TILE_COORDINATE_FILE_ID_OFFSET * fileId + tileId;
    }

    // Decode all three coordinates from an encoded coordinate using bitwise operators
    public static Decode(encodedCoordinate: number): TileCoordinate {
        const x = encodedCoordinate & 4095;
        const layer = encodedCoordinate >> 24 & 127;
        const y = encodedCoordinate >> 12 & 4095;
        const fileId = Math.floor(encodedCoordinate / TILE_COORDINATE_FILE_ID_OFFSET);
        return new TileCoordinate(x, y, layer, fileId);
    }

    // Shortcut to quickly decode just the layer from an encoded coordinate
    public static GetLayer(encodedCoordinate: number): number {
        return encodedCoordinate >> 24 & 127;
    }

    public static GetFileId(encodedCoordinate: number): number {
        return Math.floor(encodedCoordinate / TILE_COORDINATE_FILE_ID_OFFSET);
    }
}