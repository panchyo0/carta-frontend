import * as React from "react";
import {observer} from "mobx-react";
import {Icon, NonIdealState, Spinner, HTMLTable, ITreeNode, Tooltip, Tree} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {toFixed} from "utilities";
import "./FileListComponent.css";

@observer
export class FileListComponent extends React.Component<{
    darkTheme: boolean,
    files: CARTA.IFileListResponse,
    hduLists: ITreeNode[],
    selectedFile: CARTA.IFileInfo,
    selectedHDU: string,
    onFileClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFileDoubleClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFolderClicked: (folder: string, absolute: boolean) => void
}, { sortColumn: string, sortDirection: number }> {

    private static readonly FileTypeMap = new Map<CARTA.FileType, { type: string, description: string }>([
        [CARTA.FileType.FITS, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.FileType.CASA, {type: "CASA", description: "CASA Image"}],
        [CARTA.FileType.MIRIAD, {type: "Miriad", description: "ATNF Miriad Image"}],
        [CARTA.FileType.HDF5, {type: "HDF5", description: "HDF5 File (IDIA Schema)"}],
        [CARTA.FileType.CRTF, {type: "CRTF", description: "CASA Region Text Format"}],
        [CARTA.FileType.REG, {type: "DS9", description: "DS9 Region Format"}],
    ]);

    constructor(props: any) {
        super(props);
        this.state = {sortColumn: "name", sortDirection: 1};
    }

    public render() {
        const fileEntries = [];
        const fileList = this.props.files;
        const hduFileNames = this.props.hduLists.map(hduList => hduList.label);

        if (fileList) {
            let sortedDirectories = [];
            if (fileList.subdirectories && fileList.subdirectories.length) {
                sortedDirectories = fileList.subdirectories.slice();
                if (this.state.sortColumn === "name") {
                    sortedDirectories.sort((a, b) => this.state.sortDirection * (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                } else {
                    sortedDirectories.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                }
            }

            fileEntries.push(sortedDirectories.map(dir => {
                return (
                    <tr key={dir} onClick={() => this.props.onFolderClicked(dir, false)} className="file-table-entry">
                        <td><Icon icon="folder-close"/> {dir}</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }));
            
            let sortedFiles = [];
            if (fileList.files && fileList.files.length) {
                sortedFiles = fileList.files.slice();
                switch (this.state.sortColumn) {
                    case "name":
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                        break;
                    case "type":
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.type > b.type ? -1 : 1));
                        break;
                    case "size":
                    default:
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.size < b.size ? -1 : 1));
                        break;
                }
            }

            fileEntries.push(sortedFiles.map((file: CARTA.FileInfo) => {
                let className = "file-table-entry";
                if (file === this.props.selectedFile) {
                    className += " file-table-entry-selected";
                }

                const typeInfo = this.getFileTypeDisplay(file.type);
                return (
                    <tr key={`${file.name}`} onDoubleClick={() => this.props.onFileDoubleClicked(file, "")} onClick={() => this.props.onFileClicked(file, "")} className={className}>
                        <td>{hduFileNames.includes(file.name) ? this.genTreeNode(file.name) : <span><Icon icon="document"/> {file.name}</span>}</td>
                        <td><Tooltip content={typeInfo.description}>{typeInfo.type}</Tooltip></td>
                        <td>{this.getFileSizeDisplay(file.size as number)}</td>
                    </tr>
                );
            }));
        }

        if (fileList) {
            return (
                <React.Fragment>
                    <HTMLTable small={true} className="file-table">
                        <thead>
                        <tr>
                            <th onClick={() => this.setSortColumn("name")} id="file-header-name" className={this.props.darkTheme ? "dark-theme" : ""}>
                                File Name
                                {this.state.sortColumn === "name" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                            <th onClick={() => this.setSortColumn("type")} id="file-header-type" className={this.props.darkTheme ? "dark-theme" : ""}>
                                Type
                                {this.state.sortColumn === "type" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                            <th onClick={() => this.setSortColumn("size")} id="file-header-size" className={this.props.darkTheme ? "dark-theme" : ""}>
                                Size
                                {this.state.sortColumn === "size" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {fileEntries}
                        </tbody>
                    </HTMLTable>
                </React.Fragment>
            );
        } else {
            return <NonIdealState icon={<Spinner className="fileBrowserLoadingSpinner"/>} title={"Loading files"}/>;
        }
    }

    private setSortColumn(column: string) {
        if (this.state.sortColumn === column) {
            this.setState({sortDirection: this.state.sortDirection * -1});
        } else {
            this.setState({sortDirection: 1, sortColumn: column});
        }
    }

    private getFileSizeDisplay(sizeInBytes: number): string {
        if (sizeInBytes >= 1e9) {
            return `${toFixed(sizeInBytes / 1e9, 1)} GB`;
        } else if (sizeInBytes >= 1e6) {
            return `${toFixed(sizeInBytes / 1e6, 1)} MB`;
        } else if (sizeInBytes >= 1e3) {
            return `${toFixed(sizeInBytes / 1e3, 1)} kB`;
        } else {
            return `${sizeInBytes} B`;
        }
    }

    private getFileTypeDisplay(type: CARTA.FileType) {
        return FileListComponent.FileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }

    private genTreeNode = (fileName: string) => {
        const hduLists = this.props.hduLists;
        if (!hduLists) {
            return null;
        }

        const found: ITreeNode = hduLists.find(hduList => hduList.label === fileName);
        if (!found) {
            return null;
        }

        return (
            <Tree
                onNodeClick={this.handleNodeClick}
                onNodeCollapse={this.handleNodeCollapse}
                onNodeExpand={this.handleNodeExpand}
                contents={[found]}
            />
        );
    };

    private handleNodeClick = (nodeData: ITreeNode, _nodePath: number[], e: React.MouseEvent<HTMLElement>) => {
        console.log(nodeData.label + " click");
    };

    private handleNodeCollapse = (nodeData: ITreeNode) => {
        console.log(nodeData.label + " Collapse");
        nodeData.isExpanded = false;
    };

    private handleNodeExpand = (nodeData: ITreeNode) => {
        console.log(nodeData.label + " Expand");
        nodeData.isExpanded = true;
    };
}