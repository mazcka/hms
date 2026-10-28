"use client";

import {
  Children,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const GAP = 12;

type Position = {
  inlineStart: number;
  top: number;
  width: number;
};

export function MasonryGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const gridRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [layout, setLayout] = useState<{ positions: Position[]; height: number } | null>(null);

  const arrange = useCallback(() => {
    const grid = gridRef.current;
    const nodes = itemRefs.current.slice(0, items.length);
    if (!grid || nodes.some((node) => !node)) return;

    const availableWidth = grid.clientWidth;
    const columnCount = window.matchMedia("(min-width: 721px)").matches ? 2 : 1;
    const itemWidth = (availableWidth - GAP * (columnCount - 1)) / columnCount;
    const columnHeights = Array(columnCount).fill(0) as number[];

    const positions = nodes.map((node) => {
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      const top = columnHeights[column];
      const height = node!.getBoundingClientRect().height;
      columnHeights[column] = top + height + GAP;
      return {
        inlineStart: column * (itemWidth + GAP),
        top,
        width: itemWidth,
      };
    });

    setLayout({
      positions,
      height: Math.max(0, ...columnHeights) - (items.length ? GAP : 0),
    });
  }, [items.length]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const nodes = itemRefs.current.slice(0, items.length).filter(Boolean) as HTMLDivElement[];
    if (!grid || nodes.length !== items.length) return;

    const observer = new ResizeObserver(arrange);
    observer.observe(grid);
    nodes.forEach((node) => observer.observe(node));
    arrange();
    return () => observer.disconnect();
  }, [arrange, items.length]);

  return (
    <div
      className={`masonry-grid ${layout ? "masonry-grid-ready" : ""}`}
      ref={gridRef}
      style={layout ? { height: layout.height } : undefined}
    >
      {items.map((child, index) => {
        const position = layout?.positions[index];
        const style = position ? {
          "--masonry-inline-start": `${position.inlineStart}px`,
          "--masonry-top": `${position.top}px`,
          "--masonry-width": `${position.width}px`,
        } as CSSProperties : undefined;
        return (
          <div
            className="masonry-item"
            key={index}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            style={style}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
