// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Part } from "../src/part";

afterEach(cleanup);

it("composes callback cleanups and object refs without React version detection", () => {
    const ownCleanup = vi.fn();
    const childCleanup = vi.fn();
    const own = vi.fn(() => ownCleanup);
    const child = vi.fn(() => childCleanup);
    const { rerender, unmount } = render(<Part asChild ref={own}><button ref={child}>Action</button></Part>);
    expect(own).toHaveBeenCalledWith(screen.getByRole("button"));
    expect(child).toHaveBeenCalledWith(screen.getByRole("button"));
    const object = React.createRef<HTMLElement>();
    const legacy = vi.fn();
    rerender(<Part asChild ref={object}><button ref={legacy}>Action</button></Part>);
    expect(ownCleanup).toHaveBeenCalledOnce();
    expect(childCleanup).toHaveBeenCalledOnce();
    expect(object.current).toBe(screen.getByRole("button"));
    unmount();
    expect(object.current).toBeNull();
    expect(legacy).toHaveBeenLastCalledWith(null);
});

it("merges styles and invokes child events before cancellable parent events", () => {
    const parent = vi.fn();
    render(<Part asChild className="outer" style={{ color: "red", padding: 2 }} onClick={parent}><button className="inner" style={{ color: "green" }} onClick={(event) => event.preventDefault()}>Action</button></Part>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(parent).not.toHaveBeenCalled();
    expect(button.className).toBe("outer inner");
    expect(button.style.color).toBe("green");
    expect(button.style.padding).toBe("2px");
});