import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";

export class ExecutionEntry {
    target: string;
    action: string;
    parameters: any[];
    valid: boolean;
    async: boolean;
    private readonly appStore: AppStore;

    private constructor(appStore: AppStore) {
        this.appStore = appStore;
    }

    static FromString(entryString: string, appStore: AppStore): ExecutionEntry {
        const executionEntry = new ExecutionEntry(appStore);
        entryString = entryString.trim();

        const entryRegex = /^(\+?)((?:[\w\[\]]+\.)*)(\w+)\(([^)]*)\);?$/gm;
        const matches = entryRegex.exec(entryString);
        // Four matching groups, first entry is the full match
        if (matches && matches.length === 5 && matches[3].length) {
            executionEntry.async = matches[1].length > 0;
            if (matches[2].length) {
                executionEntry.target = matches[2].substring(0, matches[2].length - 1);
            }
            executionEntry.action = matches[3];
            executionEntry.valid = executionEntry.parseParameters(matches[4], true);
        } else {
            executionEntry.valid = false;
        }
        return executionEntry;
    }

    static FromScriptingRequest(requestMessage: CARTA.IScriptingRequest, appStore: AppStore): ExecutionEntry {
        const executionEntry = new ExecutionEntry(appStore);
        executionEntry.async = requestMessage.async;
        executionEntry.target = requestMessage.target;
        executionEntry.action = requestMessage.action;
        executionEntry.valid = executionEntry.parseParameters(requestMessage.parameters, false);
        return executionEntry;
    }

    private parseParameters(parameterString: string, pad: boolean) {
        const parameterRegex = /(\$(?:[\w\[\]]+\.)*)([\w\[\]]+)/gm;
        try {
            let substitutedParameterString = parameterString.replace(parameterRegex, "{\"macroTarget\": \"$1\", \"macroVariable\": \"$2\"}");
            if (pad) {
                substitutedParameterString = `[${substitutedParameterString}]`;
            }
            const parameterArray = JSON.parse(substitutedParameterString);
            this.parameters = parameterArray.map(parameter => {
                if (typeof parameter === "object" && parameter.macroTarget && parameter.macroVariable) {
                    parameter.macroTarget = parameter.macroTarget.slice(1, -1);
                }
                return parameter;
            });
        } catch (e) {
            console.log(e);
            return false;
        }
        return true;
    }

    async execute() {
        const targetObject = ExecutionEntry.GetTargetObject(this.appStore, this.target);
        if (targetObject == null) {
            throw(`Missing target object: ${this.target}`);
        }
        const currentParameters = this.parameters.map(this.mapMacro);
        let actionFunction = targetObject[this.action];
        if (!actionFunction || typeof (actionFunction) !== "function") {
            throw(`Missing action function: ${this.action}`);
        }
        actionFunction = actionFunction.bind(targetObject);
        let response;
        if (this.async) {
            response = actionFunction(...currentParameters);
        } else {
            response = await actionFunction(...currentParameters);
        }
        return response;
    }

    private static GetTargetObject(baseObject: any, targetString: string) {
        if (!targetString) {
            return baseObject;
        }

        let target = baseObject;
        const targetNameArray = targetString.split(".");
        for (const targetEntry of targetNameArray) {
            const arrayRegex = /(\w+)(?:\[(\d+)\])?/gm;
            const matches = arrayRegex.exec(targetEntry);
            // Check if there's an array index in this parameter
            if (matches && matches.length === 3 && matches[2] !== undefined) {
                target = target[matches[1]];
                if (target == null) {
                    return null;
                }
                target = target[matches[2]];
            } else {
                target = target[targetEntry];
            }
            if (target == null) {
                return null;
            }
        }
        return target;
    }

    private mapMacro = (parameter: any) => {
        if (typeof parameter === "object" && parameter.macroVariable) {
            const targetString = parameter.macroTarget ? `${parameter.macroTarget}.${parameter.macroVariable}` : parameter.macroVariable;
            return ExecutionEntry.GetTargetObject(this.appStore, targetString);
        }
        return parameter;
    };
}

export class ScriptingService {
    private static staticInstance: ScriptingService;

    static get Instance() {
        if (!ScriptingService.staticInstance) {
            ScriptingService.staticInstance = new ScriptingService();
        }
        return ScriptingService.staticInstance;
    }

    static Delay(timeout: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, timeout);
        });
    }

    handleScriptingRequest = async (requestMessage: CARTA.IScriptingRequest, appStore: AppStore): Promise<CARTA.IScriptingResponse> => {
        const entry = ExecutionEntry.FromScriptingRequest(requestMessage, appStore);
        if (!entry.valid) {
            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: false,
                message: "Failed to parse scripting request"
            };
        }

        try {
            let response: any;
            if (entry.async) {
                // If entry is asynchronous, don't wait for it to complete before moving to the next entry
                response = entry.execute();
            } else {
                response = await entry.execute();
            }
            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: true,
                response: JSON.stringify(response)
            };
        } catch (err) {
            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: false,
                message: err
            };
        }
    };

    executeEntries = async (executionEntries: ExecutionEntry[]) => {
        if (!executionEntries || !executionEntries.length) {
            return;
        }

        for (const entry of executionEntries) {
            try {
                if (entry.async) {
                    // If entry is asynchronous, don't wait for it to complete before moving to the next entry
                    const response = entry.execute();
                    console.log(response);
                } else {
                    const response = await entry.execute();
                    console.log(response);
                    // TODO: more tests to see if this is really necessary
                    await ScriptingService.Delay(10);
                }
            } catch (err) {
                console.log(err);
            }
        }
    };
}