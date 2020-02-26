import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {SpectralProfileWidgetStore, StokesAnalysisWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {SpectralSystem, SPECTRAL_COORDS_SUPPORTED} from "models";
import "./SpectralSettingsComponent.css";

@observer
export class SpectralSettingsComponent extends React.Component<{appStore: AppStore, widgetStore: SpectralProfileWidgetStore|StokesAnalysisWidgetStore, disable: boolean}> {

    render() {
        const widgetStore = this.props.widgetStore;
        const spectralCoordinateOptions: IOptionProps[] = Array.from(SPECTRAL_COORDS_SUPPORTED.keys()).map((coord: string) => { return {value: coord, label: coord}; });
        const frame = this.props.appStore.activeFrame;
        const disableSetting = this.props.disable || !frame || !frame.spectralFrame || !frame.isSpectralSettingsSupported;
        return (
            <React.Fragment>
                <div className="spectral-settings">
                    <FormGroup label={"Coordinate"} inline={true} disabled={disableSetting}>
                        <HTMLSelect
                            disabled={disableSetting}
                            value={frame.selectedSpectralCoordinate}
                            options={spectralCoordinateOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralCoordinate(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                    <FormGroup label={"System"} inline={true} disabled={disableSetting}>
                        <HTMLSelect
                            disabled={disableSetting}
                            value={frame.selectedSpectralSystem}
                            options={Object.keys(SpectralSystem).map((key) => ({label: key, value: SpectralSystem[key]}))}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralSystem(event.currentTarget.value as SpectralSystem)}
                        />
                    </FormGroup>
                </div>
            </React.Fragment>
        );
    }
}