import * as React from "react";
import type { Translations } from "chrona-core";

export interface ChronaConfig {
    locale?: string;
    timeZone?: string;
    dir?: "ltr" | "rtl";
    translations?: Partial<Translations>;
}

const ConfigContext = React.createContext<ChronaConfig>({});

export function ChronaProvider({ children, ...config }: ChronaConfig & { children: React.ReactNode }) {
    const parent = React.useContext(ConfigContext);
    const { locale = parent.locale, timeZone = parent.timeZone, dir = parent.dir, translations } = config;
    const value = React.useMemo(() => ({ locale, timeZone, dir, translations: { ...parent.translations, ...translations } }), [locale, timeZone, dir, parent.translations, translations]);
    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useChronaConfig<Options extends ChronaConfig>(options: Options): Options & ChronaConfig {
    const parent = React.useContext(ConfigContext);
    return {
        ...options,
        locale: options.locale ?? parent.locale,
        timeZone: options.timeZone ?? parent.timeZone,
        dir: options.dir ?? parent.dir,
        translations: { ...parent.translations, ...options.translations },
    };
}