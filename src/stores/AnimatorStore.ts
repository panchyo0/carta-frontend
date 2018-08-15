import {action, computed, observable} from "mobx";
import {AppStore} from "./AppStore";

export enum AnimationMode {
    CHANNEL = 0,
    STOKES = 1,
    FRAME = 2
}

export enum AnimationState {
    STOPPED = 0,
    PLAYING = 1
}

export class AnimatorStore {
    @observable frameRate: number;
    @observable maxFrameRate: number;
    @observable minFrameRate: number;

    @observable animationMode: AnimationMode;
    @observable animationState: AnimationState;
    @action setAnimationMode = (val: AnimationMode) => {
        this.animationMode = val;
    };
    @action setFrameRate = (val: number) => {
        this.frameRate = val;
    };
    @action startAnimation = () => {
        clearTimeout(this.animateTimeout);
        this.animationState = AnimationState.PLAYING;
        this.animate();
    };
    @action stopAnimation = () => {
        this.animationState = AnimationState.STOPPED;
    };
    @action animate = () => {
        if (this.animationState === AnimationState.PLAYING && this.appStore) {
            // Do animation
            switch (this.animationMode) {
                case AnimationMode.FRAME:
                    this.appStore.nextFrame();
                    break;
                case AnimationMode.CHANNEL:
                    this.appStore.activeFrame.incrementChannels(1, 0);
                    break;
                case AnimationMode.STOKES:
                    this.appStore.activeFrame.incrementChannels(0, 1);
                    break;
                default:
                    break;
            }
            // Schedule next update
            this.animateTimeout = setTimeout(this.animate, this.frameInterval);
        }
    };

    private readonly appStore: AppStore;
    private animateTimeout;

    constructor(appStore: AppStore) {
        this.frameRate = 5;
        this.maxFrameRate = 15;
        this.minFrameRate = 1;
        this.animationMode = AnimationMode.CHANNEL;
        this.animationState = AnimationState.STOPPED;
        this.animateTimeout = null;
        this.appStore = appStore;
    }

    @computed get frameInterval() {
        return 1000.0 / Math.min(this.maxFrameRate, Math.max(this.minFrameRate, this.frameRate));
    }
}