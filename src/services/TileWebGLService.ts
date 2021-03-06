import allMaps from "static/allmaps.png";
import {getShaderProgram, loadImageTexture} from "utilities";
import {TEXTURE_SIZE, TILE_SIZE} from "./TileService";

const vertexShader = require("!raw-loader!./GLSL/vertex_shader_raster.glsl");
const pixelShader = require("!raw-loader!./GLSL/pixel_shader_raster.glsl");

interface ShaderUniforms {
    MinVal: WebGLUniformLocation;
    MaxVal: WebGLUniformLocation;
    Bias: WebGLUniformLocation;
    Contrast: WebGLUniformLocation;
    Gamma: WebGLUniformLocation;
    Alpha: WebGLUniformLocation;
    ScaleType: WebGLUniformLocation;
    Inverted: WebGLUniformLocation;
    NaNColor: WebGLUniformLocation;
    DataTexture: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    CanvasWidth: WebGLUniformLocation;
    CanvasHeight: WebGLUniformLocation;
    RotationOrigin: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
    TileSize: WebGLUniformLocation;
    TileScaling: WebGLUniformLocation;
    TileOffset: WebGLUniformLocation;
    TileTextureOffset: WebGLUniformLocation;
    TileTextureSize: WebGLUniformLocation;
    TextureSize: WebGLUniformLocation;
    TileBorder: WebGLUniformLocation;
}

export class TileWebGLService {
    private static staticInstance: TileWebGLService;

    readonly gl: WebGLRenderingContext;
    cmapTexture: WebGLTexture;
    // GL buffers
    vertexPositionBuffer: WebGLBuffer;
    vertexUVBuffer: WebGLBuffer;
    // Shader attribute handles
    vertexPositionAttribute: number;
    vertexUVAttribute: number;
    // Shader uniform handles
    shaderProgram: WebGLProgram;
    shaderUniforms: ShaderUniforms;

    static get Instance() {
        if (!TileWebGLService.staticInstance) {
            TileWebGLService.staticInstance = new TileWebGLService();
        }
        return TileWebGLService.staticInstance;
    }

    public setCanvasSize = (width: number, height: number) => {
        this.gl.canvas.width = width;
        this.gl.canvas.height = height;
    };

    private initShaders() {
        this.shaderProgram = getShaderProgram(this.gl, vertexShader, pixelShader);
        this.gl.useProgram(this.shaderProgram);

        this.vertexPositionAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
        this.vertexUVAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexUV");
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
        this.gl.enableVertexAttribArray(this.vertexUVAttribute);

        this.shaderUniforms = {
            MinVal: this.gl.getUniformLocation(this.shaderProgram, "uMinVal"),
            MaxVal: this.gl.getUniformLocation(this.shaderProgram, "uMaxVal"),
            NaNColor: this.gl.getUniformLocation(this.shaderProgram, "uNaNColor"),
            Bias: this.gl.getUniformLocation(this.shaderProgram, "uBias"),
            Contrast: this.gl.getUniformLocation(this.shaderProgram, "uContrast"),
            Gamma: this.gl.getUniformLocation(this.shaderProgram, "uGamma"),
            Alpha: this.gl.getUniformLocation(this.shaderProgram, "uAlpha"),
            ScaleType: this.gl.getUniformLocation(this.shaderProgram, "uScaleType"),
            Inverted: this.gl.getUniformLocation(this.shaderProgram, "uInverted"),
            DataTexture: this.gl.getUniformLocation(this.shaderProgram, "uDataTexture"),
            CmapTexture: this.gl.getUniformLocation(this.shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(this.shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(this.shaderProgram, "uCmapIndex"),
            CanvasWidth: this.gl.getUniformLocation(this.shaderProgram, "uCanvasWidth"),
            CanvasHeight: this.gl.getUniformLocation(this.shaderProgram, "uCanvasHeight"),
            ScaleAdjustment: this.gl.getUniformLocation(this.shaderProgram, "uScaleAdjustment"),
            RotationOrigin: this.gl.getUniformLocation(this.shaderProgram, "uRotationOrigin"),
            RotationAngle: this.gl.getUniformLocation(this.shaderProgram, "uRotationAngle"),
            TileSize: this.gl.getUniformLocation(this.shaderProgram, "uTileSize"),
            TileScaling: this.gl.getUniformLocation(this.shaderProgram, "uTileScaling"),
            TileOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileOffset"),
            TileTextureOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureOffset"),
            TextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTextureSize"),
            TileTextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureSize"),
            TileBorder: this.gl.getUniformLocation(this.shaderProgram, "uTileBorder")
        };

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapIndex, 2);
        this.gl.uniform1f(this.shaderUniforms.MinVal, 3.4);
        this.gl.uniform1f(this.shaderUniforms.MaxVal, 5.50);
        this.gl.uniform1f(this.shaderUniforms.Bias, 0);
        this.gl.uniform1f(this.shaderUniforms.Contrast, 1);
        this.gl.uniform1f(this.shaderUniforms.Gamma, 1);
        this.gl.uniform1f(this.shaderUniforms.Alpha, 1000);
        this.gl.uniform1i(this.shaderUniforms.Inverted, 0);
        this.gl.uniform1f(this.shaderUniforms.TileBorder, 0 / TILE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileSize, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileScaling, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileOffset, 0, 0);
        this.gl.uniform2f(this.shaderUniforms.TileTextureOffset, 0, 0);
        this.gl.uniform1f(this.shaderUniforms.TextureSize, TEXTURE_SIZE);
        this.gl.uniform1f(this.shaderUniforms.TileTextureSize, TILE_SIZE);
        this.gl.uniform4f(this.shaderUniforms.NaNColor, 0, 0, 1, 1);
    }

    private initBuffers() {
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        const vertices = new Float32Array([
            0.0, 0.0, 0,
            1.0, 0.0, 0,
            0.0, 1.0, 0,
            1.0, 1.0, 0
        ]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, vertices, WebGLRenderingContext.STATIC_DRAW);

        this.vertexUVBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        const uvs = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, uvs, WebGLRenderingContext.STATIC_DRAW);
    }

    private constructor() {
        this.gl = document.createElement("canvas").getContext("webgl");
        this.gl.getExtension("OES_texture_float");
        this.initShaders();
        this.initBuffers();
        loadImageTexture(this.gl, allMaps, WebGLRenderingContext.TEXTURE1).then(texture => {
            this.cmapTexture = texture;
        });
    }
}