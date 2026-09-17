import { expect, it, vi } from "vitest";
import { createStore } from "../src/index";

it("publishes changed snapshots only and preserves the server snapshot", () => {
    const initial = { count: 0 };
    const store = createStore(initial);
    const listener = vi.fn(() => store.getSnapshot());
    const unsubscribe = store.subscribe(listener);
    store.setState(initial);
    expect(listener).not.toHaveBeenCalled();
    const next = { count: 1 };
    store.setState(next);
    expect(listener).toHaveReturnedWith(next);
    expect(store.getServerSnapshot()).toBe(initial);
    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledOnce();
});