export interface Store<State> {
    getSnapshot: () => State;
    getServerSnapshot: () => State;
    subscribe: (listener: () => void) => () => void;
    setState: (state: State) => void;
}

export function createStore<State>(initial: State): Store<State> {
    let snapshot = initial;
    const listeners = new Set<() => void>();
    return {
        getSnapshot: () => snapshot,
        getServerSnapshot: () => initial,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        setState(state) {
            if (Object.is(state, snapshot)) return;
            snapshot = state;
            for (const listener of listeners) listener();
        },
    };
}