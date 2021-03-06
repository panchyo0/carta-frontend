import * as AST from "ast_wrapper";
import {action, observable, ObservableMap} from "mobx";
import {Colors} from "@blueprintjs/core";
import {SystemType} from "stores";
import {CatalogOverlayShape} from "stores/widgets";

type CatalogSettings = {
    fileId: number,
    color: string,
    size: number,
    shape: CatalogOverlayShape,
    xImageCoords: Array<Float64Array>,
    yImageCoords: Array<Float64Array>,
    selectedPointIndexs: Array<number>,
    showSelectedData: boolean;
};

export class CatalogStore {
    private static staticInstance: CatalogStore;

    static get Instance() {
        if (!CatalogStore.staticInstance) {
            CatalogStore.staticInstance = new CatalogStore();
        }
        return CatalogStore.staticInstance;
    }

    private readonly degreeUnits = ["deg", "degrees"];
    private readonly arcsecUnits = ["arcsec", "arcsecond"];
    private readonly arcminUnits = ["arcmin", "arcminute"];

    @observable catalogs: ObservableMap<string, CatalogSettings>;

    private constructor() {
        this.catalogs = new ObservableMap();
    }

    @action addCatalogs(widgetId: string, fileId: number) {
        this.catalogs.set(widgetId, {
            fileId: fileId,
            color: Colors.TURQUOISE3,
            size: 5,
            shape: CatalogOverlayShape.Circle,
            xImageCoords: [],
            yImageCoords: [],
            selectedPointIndexs: [],
            showSelectedData: false
        });
    }

    @action updateCatalogData(widgetId: string, xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType) {
        const pixelData = this.transformCatalogData(xWcsData, yWcsData, wcsInfo, xUnit, yUnit, catalogFrame);
        const catalogSettings = this.catalogs.get(widgetId);
        if (catalogSettings) {
            catalogSettings.xImageCoords.push(pixelData.xImageCoords);
            catalogSettings.yImageCoords.push(pixelData.yImageCoords);
        }
    }

    @action updateCatalogSize(widgetId: string, size: number) {
        this.catalogs.get(widgetId).size = size;
    }

    @action updateCatalogColor(widgetId: string, color: string) {
        this.catalogs.get(widgetId).color = color;
    }

    @action updateCatalogShape(widgetId: string, shape: CatalogOverlayShape) {
        this.catalogs.get(widgetId).shape = shape;
    }

    @action clearData(widgetId: string) {
        const catalogSettings = this.catalogs.get(widgetId);
        if (catalogSettings) {
            catalogSettings.xImageCoords = [];
            catalogSettings.yImageCoords = [];
        }
    }

    @action removeCatalog(widgetId: string) {
        this.catalogs.delete(widgetId);
    }

    @action updateSelectedPoints(widgetId: string, selectedPointIndexs: number[]) {
        const catalog = this.catalogs.get(widgetId);
        if (catalog) {
            catalog.selectedPointIndexs = selectedPointIndexs;
        }
    }

    @action unSelectedPoints() {
        if (this.catalogs.size > 0) {
            this.catalogs.forEach(catalog => {
                catalog.selectedPointIndexs = [];
            });
        }
    }

    @action updateShowSelectedData(widgetId: string, val: boolean) {
        const catalog = this.catalogs.get(widgetId);
        catalog.showSelectedData = val;
    }

    private transformCatalogData(xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType): {xImageCoords: Float64Array, yImageCoords: Float64Array} {
        if (xWcsData.length === yWcsData.length) {
            const N = xWcsData.length;

            const xUnitLowerCase = xUnit.toLocaleLowerCase();
            const yUnitLowerCase = yUnit.toLocaleLowerCase();
            let xFraction = 1;
            let yFraction = 1;

            let wcsCopy = AST.copy(wcsInfo);
            let system = "System=" + catalogFrame;
            AST.set(wcsCopy, system);
            if (catalogFrame === SystemType.FK4) {
                AST.set(wcsCopy, "Epoch=B1950");
                AST.set(wcsCopy, "Equinox=1950");
            }

            if (catalogFrame === SystemType.FK5) {
                AST.set(wcsCopy, "Epoch=J2000");
                AST.set(wcsCopy, "Equinox=2000");
            }

            if (this.degreeUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 180.0;
            } else if (this.arcminUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 10800.0;
            } else if (this.arcsecUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 648000.0;
            } else {
                // if unit is null, using deg as default
                xFraction = Math.PI / 180.0;
            }

            if (this.degreeUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 180.0;
            } else if (this.arcminUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 10800.0;
            } else if (this.arcsecUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 648000.0;
            } else {
                yFraction = Math.PI / 180.0;
            }

            const xWCSValues = new Float64Array(N);
            const yWCSValues = new Float64Array(N);

            for (let i = 0; i < N; i++) {
                xWCSValues[i] = xWcsData[i] * xFraction;
                yWCSValues[i] = yWcsData[i] * yFraction;
            }

            const results = AST.transformPointArrays(wcsCopy, xWCSValues, yWCSValues, 0);
            AST.delete(wcsCopy);
            return {xImageCoords: results.x, yImageCoords: results.y};
        }
        return {xImageCoords: new Float64Array(0), yImageCoords: new Float64Array(0)};
    }
}