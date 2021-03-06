import * as React from "react";
import {CSSProperties} from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Menu, MenuDivider, MenuItem, NonIdealState, Tooltip} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, RowHeaderCell, SelectionModes, Table} from "@blueprintjs/table";
import {IMenuContext} from "@blueprintjs/table/src/interactions/menus/menuContext";
import ReactResizeDetector from "react-resize-detector";
import {WidgetConfig, WidgetProps, HelpType, AppStore} from "stores";
import "./LayerListComponent.css";

@observer
export class LayerListComponent extends React.Component<WidgetProps> {
    @observable width: number = 0;
    @observable height: number = 0;
    @observable columnWidths = [150, 70, 85, 80, 70];

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "layer-list",
            type: "layer-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Layer List",
            isCloseable: true,
            helpType: HelpType.LAYER_LIST
        };
    }

    private onColumnWidthsChange = (index: number, size: number) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.columnWidths.length || size <= 0) {
            return;
        }
        this.columnWidths[index] = size;
        this.forceUpdate();
    };

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private handleFileReordered = (oldIndex: number, newIndex: number, length: number) => {
        if (oldIndex === newIndex) {
            return;
        }
        AppStore.Instance.reorderFrame(oldIndex, newIndex, length);
    };

    private rowHeaderCellRenderer = (rowIndex: number) => {
        return <RowHeaderCell name={rowIndex.toString()} className={rowIndex === AppStore.Instance.activeFrameIndex ? "active-row-cell" : ""}/>;
    };

    private fileNameRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell/>;
        }

        const frame = appStore.frames[rowIndex];

        return (
            <Cell className={rowIndex === appStore.activeFrameIndex ? "active-row-cell" : ""}>
                <React.Fragment>
                    <div className="name-cell" onClick={() => appStore.setActiveFrame(frame.frameInfo.fileId)}>
                        {frame.frameInfo.fileInfo.name}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private channelRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell/>;
        }
        return <Cell className={rowIndex === appStore.activeFrameIndex ? "active-row-cell" : ""}>{appStore.frames[rowIndex].requiredChannel}</Cell>;
    };

    private stokesRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell/>;
        }
        return <Cell className={rowIndex === appStore.activeFrameIndex ? "active-row-cell" : ""}>{appStore.frames[rowIndex].requiredStokes}</Cell>;
    };

    private typeRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell/>;
        }

        const frame = appStore.frames[rowIndex];

        return (
            <Cell className={rowIndex === appStore.activeFrameIndex ? "active-row-cell" : ""}>
                <React.Fragment>
                    <Tooltip position={"bottom"} content={<span>Raster image<br/><i><small>Click to {frame.renderConfig.visible ? "hide" : "show"}</small></i></span>}>
                        <AnchorButton minimal={true} small={true} active={frame.renderConfig.visible} intent={frame.renderConfig.visible ? "success" : "none"} onClick={frame.renderConfig.toggleVisibility}>R</AnchorButton>
                    </Tooltip>
                    {frame.contourConfig.enabled &&
                    <Tooltip position={"bottom"} content={<span>Contour image<br/><i><small>Click to {frame.contourConfig.visible ? "hide" : "show"}</small></i></span>}>
                        <AnchorButton minimal={true} small={true} active={frame.contourConfig.visible} intent={frame.contourConfig.visible ? "success" : "none"} onClick={frame.contourConfig.toggleVisibility}>C</AnchorButton>
                    </Tooltip>
                    }
                </React.Fragment>
            </Cell>
        );
    };

    private matchingRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell/>;
        }

        const frame = appStore.frames[rowIndex];

        let spatialMatchingButton: React.ReactNode;
        if (appStore.spatialReference) {
            let tooltipSubtitle: string;
            if (frame === appStore.spatialReference) {
                tooltipSubtitle = `${frame.frameInfo.fileInfo.name} is the current spatial reference`;
            } else {
                tooltipSubtitle = `Click to ${frame.spatialReference ? "disable" : "enable"} matching to ${appStore.spatialReference.frameInfo.fileInfo.name}`;
            }
            spatialMatchingButton = (
                <Tooltip position={"bottom"} content={<span>Spatial matching<br/><i><small>{tooltipSubtitle}</small></i></span>}>
                    <AnchorButton
                        className={frame === appStore.spatialReference ? "outlined" : ""}
                        minimal={true}
                        small={true}
                        active={!!frame.spatialReference}
                        intent={frame.spatialReference ? "success" : "none"}
                        onClick={() => appStore.toggleSpatialMatching(frame)}
                    >
                        XY
                    </AnchorButton>
                </Tooltip>
            );
        }

        let spectralMatchingButton: React.ReactNode;
        if (frame.frameInfo.fileInfoExtended.depth > 1 && appStore.spectralReference) {
            let tooltipSubtitle: string;
            if (frame === appStore.spectralReference) {
                tooltipSubtitle = `${frame.frameInfo.fileInfo.name} is the current spectral reference`;
            } else {
                tooltipSubtitle = `Click to ${frame.spectralReference ? "disable" : "enable"} matching to ${appStore.spectralReference.frameInfo.fileInfo.name}`;
            }
            spectralMatchingButton = (
                <Tooltip position={"bottom"} content={<span>Spectral matching<br/><i><small>{tooltipSubtitle}</small></i></span>}>
                    <AnchorButton
                        className={frame === appStore.spectralReference ? "outlined" : ""}
                        minimal={true}
                        small={true}
                        active={!!frame.spectralReference}
                        intent={frame.spectralReference ? "success" : "none"}
                        onClick={() => appStore.toggleSpectralMatching(frame)}
                    >
                        Z
                    </AnchorButton>
                </Tooltip>
            );
        }

        return (
            <Cell className={rowIndex === appStore.activeFrameIndex ? "active-row-cell" : ""}>
                <React.Fragment>
                    {spatialMatchingButton}
                    {spectralMatchingButton}
                </React.Fragment>
            </Cell>
        );
    };

    private columnHeaderRenderer = (columnIndex: number) => {
        let name: string;
        switch (columnIndex) {
            case 0:
                name = "File name";
                break;
            case 1:
                name = "Type";
                break;
            case 2:
                name = "Matching";
                break;
            case 3:
                name = "Channel";
                break;
            case 4:
                name = "Stokes";
                break;
            default:
                break;
        }

        const columnHeaderStyleProps: CSSProperties = {
            fontSize: "12",
            fontWeight: "bold"
        };

        return <ColumnHeaderCell name={name} style={columnHeaderStyleProps}/>;
    };

    private contextMenuRenderer = (context: IMenuContext) => {
        const rows = context.getTarget().rows;
        const appStore = AppStore.Instance;
        if (rows && rows.length && appStore.frames[rows[0]]) {
            const frame = appStore.frames[rows[0]];
            if (frame) {
                return (
                    <Menu>
                        <MenuItem disabled={appStore.spatialReference === frame} text="Set as spatial reference" onClick={() => appStore.setSpatialReference(frame)}/>
                        <MenuItem disabled={appStore.spectralReference === frame || frame.frameInfo.fileInfoExtended.depth <= 1} text="Set as spectral reference" onClick={() => appStore.setSpectralReference(frame)}/>
                        <MenuDivider/>
                        <MenuItem text="Close image" onClick={() => appStore.closeFile(frame)}/>
                    </Menu>
                );
            }
        }
        return null;
    };

    render() {
        const appStore = AppStore.Instance;
        const frameNum = appStore.frameNum;

        if (frameNum <= 0) {
            return (
                <div className="layer-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        // This is a necessary hack in order to trigger a re-rendering when values change, because the cell renderer is in its own function
        // There is probably a neater way to do this, though
        const frameChannels = appStore.frameChannels;
        const frameStokes = appStore.frameStokes;
        const activeFrameIndex = appStore.activeFrameIndex;
        const visibilityRaster = appStore.frames.map(f => f.renderConfig.visible);
        const visibilityContour = appStore.frames.map(f => f.contourConfig.visible && f.contourConfig.enabled);
        const matchingTypes = appStore.frames.map(f => f.spatialReference && f.spectralReference);
        const currentSpectralReference = appStore.spectralReference;
        const currentSpatialReference = appStore.spatialReference;

        return (
            <div className="layer-list-widget">
                {this.width > 0 &&
                <Table
                    numRows={frameNum}
                    rowHeaderCellRenderer={this.rowHeaderCellRenderer}
                    enableRowHeader={true}
                    enableRowReordering={true}
                    enableRowResizing={false}
                    selectionModes={SelectionModes.ROWS_ONLY}
                    enableMultipleSelection={true}
                    onRowsReordered={this.handleFileReordered}
                    columnWidths={this.columnWidths}
                    enableColumnResizing={true}
                    onColumnWidthChanged={this.onColumnWidthsChange}
                    bodyContextMenuRenderer={this.contextMenuRenderer}
                >
                    <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.fileNameRenderer}/>
                    <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.typeRenderer}/>
                    <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.matchingRenderer}/>
                    <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.channelRenderer}/>
                    <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.stokesRenderer}/>
                </Table>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}