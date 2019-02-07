import {action, computed, observable} from "mobx";
import {Point2D} from "models";

export enum RegionType {
    POINT = 0,
    RECTANGLE = 3,
    ELLIPSE = 4,
    POLYGON = 6
}

export class RegionStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable regionType: RegionType;
    @observable channelMin: number;
    @observable channelMax: number;
    @observable stokesValues: number[];
    @observable controlPoints: Point2D[];
    @observable rotation: number;
    @observable editing: boolean;

    @computed get isValid() {
        // All regions require at least one control point
        if (!this.controlPoints || !this.controlPoints.length) {
            return false;
        }

        // Basic validation, ensuring that the region has the correct number of control points
        switch (this.regionType) {
            case RegionType.POINT:
                return this.controlPoints.length === 1;
            case RegionType.RECTANGLE:
                return this.controlPoints.length === 2;
            case RegionType.ELLIPSE:
                return this.controlPoints.length === 2;
            default:
                return false;
        }
    }

    constructor(fileId: number, controlPoints: Point2D[], regionType: RegionType, regionId: number = -1, rotation: number = 0, channelMin: number = -1, channelMax: number = -1, stokesValues: number[] = []) {
        this.fileId = fileId;
        this.controlPoints = controlPoints;
        this.regionType = regionType;
        this.regionId = regionId;
        this.channelMin = channelMin;
        this.channelMax = channelMax;
        this.stokesValues = stokesValues;
        this.rotation = rotation;
    }

    @action setControlPoint = (index: number, p: Point2D) => {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = p;
        }
    };

    @action setControlPoints = (points: Point2D[]) => {
        this.controlPoints = points;
    };

    @action setRotation = (angle: number) => {
        this.rotation = angle;
    };

    @action beginEditing = () => {
        this.editing = true;
    };

    @action endEditing = () => {
        this.editing = false;
    };
}