export interface PickerState { open: boolean }
export type PickerEvent = { type: "OPEN" | "CLOSE" | "TOGGLE" | "SELECT" };
export type PickerEffect = { type: "openChange"; open: boolean };

export function transitionPicker(state: PickerState, event: PickerEvent, options: { disabled?: boolean } = {}): { state: PickerState; effects: PickerEffect[] } {
    const open = event.type === "OPEN" || (event.type === "TOGGLE" && !state.open);
    if ((options.disabled && open) || open === state.open) return { state, effects: [] };
    return { state: { open }, effects: [{ type: "openChange", open }] };
}