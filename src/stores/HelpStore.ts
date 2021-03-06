import {action, observable} from "mobx";
import {Position} from "@blueprintjs/core";

export class HelpStore {
    private static staticInstance: HelpStore;

    static get Instance() {
        if (!HelpStore.staticInstance) {
            HelpStore.staticInstance = new HelpStore();
        }
        return HelpStore.staticInstance;
    }

    @observable type: HelpType;
    @observable helpVisible: boolean = false;
    @observable position: Position = Position.RIGHT;

    @action showHelpDrawer = (helpType: HelpType, centerX: number) => {
        this.type = helpType;
        this.position = centerX > document.body.clientWidth * 0.5 ? Position.LEFT : Position.RIGHT;
        this.helpVisible = true;
    };

    @action hideHelpDrawer = () => {
        this.helpVisible = false;
    };
}

export enum HelpType {
    // Dialogs
    CONTOUR = "contour",
    PREFERENCES = "preferences",
    FILE_Browser = "file-browser",
    FILE_INFO = "file-info",
    SAVE_LAYOUT = "save-layout",
    OVERLAY_SETTINGS  = "overlay-settings",
    REGION_DIALOG = "region-dialog",

    // Widgets
    ANIMATOR = "animator",
    HISTOGRAM = "histogram",
    HISTOGRAM_SETTINGS = "histogram-settings",
    IMAGE_VIEW = "image-view",
    LAYER_LIST = "layer-list",
    LOG = "log",
    PLACEHOLDER = "placeholder",
    REGION_LIST = "region-list",
    RENDER_CONFIG = "render-config",
    RENDER_CONFIG_SETTINGS = "render-config-settings",
    SPATIAL_PROFILER = "spatial-profiler",
    SPATIAL_PROFILER_SETTINGS = "spatial-profiler-settings",
    SPECTRAL_PROFILER = "spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS = "spectral-profiler-settings",
    STATS = "stats",
    STOKES_ANALYSIS = "stoke-analysis",
    STOKES_ANALYSIS_SETTINGS = "stoke-analysis-settings",
    CATALOG_OVERLAY = "catalog-overlay",
    CATALOG_SCATTER = "catalog-scatter"
}
