if (process.env.CHRONA_TEMPORAL !== "native") {
    await import("temporal-polyfill/global");
}
export { };