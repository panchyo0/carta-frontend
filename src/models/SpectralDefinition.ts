export interface ChannelType {
    code: string;
    unit: string;
    name: string;
}

// From FITS standard (Table 25 of V4.0 of "Definition of the Flexible Image Transport System")
export const CHANNEL_TYPES: ChannelType[] = [
    {code: "FREQ", name: "Frequency", unit: "Hz"},
    {code: "ENER", name: "Energy", unit: "J"},
    {code: "WAVN", name: "Wavenumber", unit: "1/m"},
    {code: "VRAD", name: "Radio velocity", unit: "m/s"},
    {code: "WAVE", name: "Vacuum wavelength", unit: "m"},
    {code: "VOPT", name: "Optical velocity", unit: "m/s"},
    {code: "ZOPT", name: "Redshift", unit: ""},
    {code: "AWAV", name: "Air wavelength", unit: "m"},
    {code: "VELO", name: "Apparent radial velocity", unit: "m/s"},
    {code: "BETA", name: "Beta", unit: ""},
];

export enum SpectralType {
    VRAD = "VRAD",
    VOPT = "VOPT",
    FREQ = "FREQ",
    WAVE = "WAVE",
    AWAV = "AWAV",
    CHANNEL = "CHANNEL"
}

// Channel is not a valid standalone spectral type
export const IsSpectralTypeSupported = (type: string): boolean => {
    return type && type !== SpectralType.CHANNEL && (<any> Object).values(SpectralType).includes(type);
};

export const SPECTRAL_MATCHING_TYPES: SpectralType[] = [SpectralType.VRAD, SpectralType.VOPT, SpectralType.FREQ, SpectralType.CHANNEL];
export function IsSpectralMatchingTypeValid(type: SpectralType) {
    return type && SPECTRAL_MATCHING_TYPES.includes(type);
}

export enum SpectralUnit {
    KMS = "km/s",
    MS = "m/s",
    GHZ = "GHz",
    MHZ = "MHz",
    KHZ = "kHz",
    HZ = "Hz",
    M = "m",
    MM = "mm",
    UM = "um",
    NM = "nm",
    ANGSTROM  = "Angstrom"
}
export const IsSpectralUnitSupported = (unit: string): boolean => {
    return unit && (<any> Object).values(SpectralUnit).includes(unit);
};

export enum SpectralSystem {
    LSRK = "LSRK",
    LSRD = "LSRD",
    BARY = "BARYCENT",
    TOPO = "TOPOCENT"
}
export const IsSpectralSystemSupported = (system: string): boolean => {
    return system && (<any> Object).values(SpectralSystem).includes(system);
};

export const SPECTRAL_TYPE_STRING = new Map<SpectralType, string>([
    [SpectralType.VRAD, "Radio velocity"],
    [SpectralType.VOPT, "Optical velocity"],
    [SpectralType.FREQ, "Frequency"],
    [SpectralType.WAVE, "Vacuum wavelength"],
    [SpectralType.AWAV, "Air wavelength"],
    [SpectralType.CHANNEL, "Channel"]
]);

export const SPECTRAL_DEFAULT_UNIT = new Map<SpectralType, SpectralUnit>([
    [SpectralType.VRAD, SpectralUnit.KMS],
    [SpectralType.VOPT, SpectralUnit.KMS],
    [SpectralType.FREQ, SpectralUnit.GHZ],
    [SpectralType.WAVE, SpectralUnit.MM],
    [SpectralType.AWAV, SpectralUnit.MM]
]);

export const GenCoordinateLabel = (type: SpectralType, unit: SpectralUnit): string => {
    return `${type ? SPECTRAL_TYPE_STRING.get(type) : ""}${unit ? " (" + unit + ")" : ""}`;
};

export const SPECTRAL_COORDS_SUPPORTED = new Map<string, {type: SpectralType, unit: SpectralUnit}>([
    [GenCoordinateLabel(SpectralType.VRAD, SpectralUnit.KMS), {type: SpectralType.VRAD, unit: SpectralUnit.KMS}],
    [GenCoordinateLabel(SpectralType.VRAD, SpectralUnit.MS), {type: SpectralType.VRAD, unit: SpectralUnit.MS}],
    [GenCoordinateLabel(SpectralType.VOPT, SpectralUnit.KMS), {type: SpectralType.VOPT, unit: SpectralUnit.KMS}],
    [GenCoordinateLabel(SpectralType.VOPT, SpectralUnit.MS), {type: SpectralType.VOPT, unit: SpectralUnit.MS}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.GHZ), {type: SpectralType.FREQ, unit: SpectralUnit.GHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.MHZ), {type: SpectralType.FREQ, unit: SpectralUnit.MHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.KHZ), {type: SpectralType.FREQ, unit: SpectralUnit.KHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.HZ), {type: SpectralType.FREQ, unit: SpectralUnit.HZ}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.M), {type: SpectralType.WAVE, unit: SpectralUnit.M}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.MM), {type: SpectralType.WAVE, unit: SpectralUnit.MM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.UM), {type: SpectralType.WAVE, unit: SpectralUnit.UM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.NM), {type: SpectralType.WAVE, unit: SpectralUnit.NM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.ANGSTROM), {type: SpectralType.WAVE, unit: SpectralUnit.ANGSTROM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.M), {type: SpectralType.AWAV, unit: SpectralUnit.M}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.MM), {type: SpectralType.AWAV, unit: SpectralUnit.MM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.UM), {type: SpectralType.AWAV, unit: SpectralUnit.UM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.NM), {type: SpectralType.AWAV, unit: SpectralUnit.NM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.ANGSTROM), {type: SpectralType.AWAV, unit: SpectralUnit.ANGSTROM}],
    ["Channel", {type: SpectralType.CHANNEL, unit: null}],
]);
