import * as React from "react";
import {CSSProperties} from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, NonIdealState, Tooltip} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, RowHeaderCell, SelectionModes, Table} from "@blueprintjs/table";
import ReactResizeDetector from "react-resize-detector";
import {WidgetConfig, WidgetProps} from "stores";
import "./LayerListComponent.css";

@observer
export class LayerListComponent extends React.Component<WidgetProps> {
    @observable width: number = 0;
    @observable height: number = 0;
    private columnWidths = [150, 80, 80, 70];

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "layer-list",
            type: "layer-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Layer List",
            isCloseable: true
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
        this.props.appStore.reorderFrame(oldIndex, newIndex, length);
    };

    render() {
        const appStore = this.props.appStore;
        const frameNum = appStore.frameNum;
        const frameNames = appStore.frameNames;
        const frameChannels = appStore.frameChannels;
        const frameStokes = appStore.frameStokes;
        const activeFrameIndex = this.props.appStore.getActiveFrameIndex;

        if (frameNum <= 0) {
            return (
                <div className="layer-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        const activeFrameStyleProps: CSSProperties = {
            fontWeight: "bold"
        };

        const rowHeaderCellRenderer = (rowIndex: number) => {
            return <RowHeaderCell name={rowIndex.toString()} className={rowIndex === activeFrameIndex ? "active-row-cell" : ""}/>;
        };
        const fileNameRenderer = (rowIndex: number) => {
            return <Cell className={rowIndex === activeFrameIndex ? "active-row-cell" : ""}>{rowIndex >= 0 && rowIndex < frameNum ? frameNames[rowIndex].label : ""}</Cell>;
        };
        const channelRenderer = (rowIndex: number) => {
            return <Cell className={rowIndex === activeFrameIndex ? "active-row-cell" : ""}>{rowIndex >= 0 && rowIndex < frameNum ? frameChannels[rowIndex] : ""}</Cell>;
        };
        const stokesRenderer = (rowIndex: number) => {
            return <Cell className={rowIndex === activeFrameIndex ? "active-row-cell" : ""}>{rowIndex >= 0 && rowIndex < frameNum ? frameStokes[rowIndex] : ""}</Cell>;
        };
        const typeRenderer = (rowIndex: number) => {
            if (rowIndex < 0 || rowIndex >= frameNum) {
                return null;
            }

            const frame = appStore.frames[rowIndex];

            return (
                <Cell className={rowIndex === activeFrameIndex ? "active-row-cell" : ""}>
                    <React.Fragment>
                        <Tooltip content={<span>Raster image<br/><i><small>Click to {frame.renderConfig.visible ? "hide" : "show"}</small></i></span>}>
                            <AnchorButton minimal={true} small={true} intent={frame.renderConfig.visible ? "success" : "none"} onClick={frame.renderConfig.toggleVisibility}>R</AnchorButton>
                        </Tooltip>
                        {frame.contourConfig.enabled &&
                        <Tooltip content={<span>Contour image<br/><i><small>Click to {frame.contourConfig.visible ? "hide" : "show"}</small></i></span>}>
                            <AnchorButton minimal={true} small={true} intent={frame.contourConfig.visible ? "success" : "none"} onClick={frame.contourConfig.toggleVisibility}>C</AnchorButton>
                        </Tooltip>
                        }
                    </React.Fragment>
                </Cell>
            );
        };

        const columnHeaderStyleProps: CSSProperties = {
            fontSize: "12",
            fontWeight: "bold"
        };

        // This is a necessary hack in order to trigger a re-rendering when values change, because the cell renderer is in its own function
        // There is probably a neater way to do this, though
        const dummyVisibilityRaster = appStore.frames.map(f => f.renderConfig.visible);
        const dummyVisibilityContour = appStore.frames.map(f => f.contourConfig.visible && f.contourConfig.enabled);

        return (
            <div className="layer-list-widget">
                <Table
                    numRows={frameNum}
                    rowHeaderCellRenderer={rowHeaderCellRenderer}
                    enableRowHeader={true}
                    enableRowReordering={true}
                    enableRowResizing={false}
                    selectionModes={SelectionModes.ROWS_ONLY}
                    enableMultipleSelection={true}
                    onRowsReordered={this.handleFileReordered}
                    columnWidths={this.columnWidths}
                    enableColumnResizing={true}
                    onColumnWidthChanged={this.onColumnWidthsChange}
                >
                    <Column
                        columnHeaderCellRenderer={(columnIndex: number) => <ColumnHeaderCell name="File name" style={columnHeaderStyleProps}/>}
                        cellRenderer={fileNameRenderer}
                    />
                    <Column
                        columnHeaderCellRenderer={(columnIndex: number) => <ColumnHeaderCell name="Type" style={columnHeaderStyleProps}/>}
                        cellRenderer={typeRenderer}
                    />
                    <Column
                        columnHeaderCellRenderer={(columnIndex: number) => <ColumnHeaderCell name="Channel" style={columnHeaderStyleProps}/>}
                        cellRenderer={channelRenderer}
                    />
                    <Column
                        columnHeaderCellRenderer={(columnIndex: number) => <ColumnHeaderCell name="Stokes" style={columnHeaderStyleProps}/>}
                        cellRenderer={stokesRenderer}
                    />
                </Table>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}