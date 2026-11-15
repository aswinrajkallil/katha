import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./HorizontalScroller.css";

export default function HorizontalScroller({
  children,
  className = "",
  gap = 14,
  scrollStep = 280,
  ariaLabel = "Horizontal scroll section",
}) {
  const containerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 2;

    setCanScrollLeft(hasOverflow && scrollLeft > 4);
    setCanScrollRight(hasOverflow && scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  // Monitor resize and scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollState();

    const handleScroll = () => {
      updateScrollState();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState();
      });
      resizeObserver.observe(el);
    }

    const handleWindowResize = () => {
      updateScrollState();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [updateScrollState, children]);

  const handleScroll = (dir) => {
    const el = containerRef.current;
    if (!el) return;
    const amount = dir === "left" ? -scrollStep : scrollStep;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className={`horizontal-scroller-root ${className}`.trim()} aria-label={ariaLabel}>
      {/* Left Fade & Arrow */}
      {canScrollLeft && (
        <>
          <div className="horizontal-scroller-fade left" aria-hidden="true" />
          <button
            type="button"
            className="horizontal-scroller-btn left"
            onClick={() => handleScroll("left")}
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>
        </>
      )}

      {/* Scrollable Track */}
      <div
        ref={containerRef}
        className="horizontal-scroller-track"
        style={{ gap: `${gap}px` }}
      >
        {children}
      </div>

      {/* Right Fade & Arrow */}
      {canScrollRight && (
        <>
          <div className="horizontal-scroller-fade right" aria-hidden="true" />
          <button
            type="button"
            className="horizontal-scroller-btn right"
            onClick={() => handleScroll("right")}
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}
