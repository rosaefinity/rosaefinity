// =============================================
// Snap Manager — Handles grid snapping and
// provides interface for future guide snapping.
// =============================================

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export interface Guide {
  id: string;
  axis: "x" | "y";
  position: number;
}

export class SnapManager {
  private gridSize: number = 10;
  private gridEnabled: boolean = true;
  private guides: Guide[] = [];
  private guideEnabled: boolean = false;
  private guideThreshold: number = 5;

  /**
   * Set the grid size for snapping.
   */
  setGridSize(size: number): void {
    if (typeof size !== "number" || size <= 0 || Number.isNaN(size)) {
      throw new Error("[SnapManager] Grid size must be a positive number");
    }
    this.gridSize = size;
  }

  /**
   * Get the current grid size.
   */
  getGridSize(): number {
    return this.gridSize;
  }

  /**
   * Enable grid snapping.
   */
  enableGrid(): void {
    this.gridEnabled = true;
  }

  /**
   * Disable grid snapping.
   */
  disableGrid(): void {
    this.gridEnabled = false;
  }

  /**
   * Check if grid snapping is enabled.
   */
  isGridEnabled(): boolean {
    return this.gridEnabled;
  }

  /**
   * Snap a position to the grid.
   */
  snapToGrid(x: number, y: number): SnapResult {
    if (!this.gridEnabled) {
      return { x, y, snappedX: false, snappedY: false };
    }

    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;

    return {
      x: snappedX,
      y: snappedY,
      snappedX: snappedX !== x,
      snappedY: snappedY !== y,
    };
  }

  /**
   * Add a guide line for snapping.
   */
  addGuide(id: string, axis: "x" | "y", position: number): void {
    if (!id || typeof id !== "string") {
      throw new Error("[SnapManager] Guide ID cannot be empty");
    }
    this.guides.push({ id, axis, position });
  }

  /**
   * Remove a guide line.
   */
  removeGuide(id: string): void {
    this.guides = this.guides.filter((g) => g.id !== id);
  }

  /**
   * Clear all guides.
   */
  clearGuides(): void {
    this.guides = [];
  }

  /**
   * Enable guide snapping.
   */
  enableGuides(): void {
    this.guideEnabled = true;
  }

  /**
   * Disable guide snapping.
   */
  disableGuides(): void {
    this.guideEnabled = false;
  }

  /**
   * Check if guide snapping is enabled.
   */
  isGuideEnabled(): boolean {
    return this.guideEnabled;
  }

  /**
   * Set the threshold distance for guide snapping (in pixels).
   */
  setGuideThreshold(threshold: number): void {
    if (typeof threshold !== "number" || threshold <= 0 || Number.isNaN(threshold)) {
      throw new Error("[SnapManager] Guide threshold must be a positive number");
    }
    this.guideThreshold = threshold;
  }

  /**
   * Get the current guide threshold.
   */
  getGuideThreshold(): number {
    return this.guideThreshold;
  }

  /**
   * Snap to guides if within threshold.
   * Returns the snapped position and which axis was snapped.
   */
  snapToGuides(x: number, y: number): SnapResult {
    if (!this.guideEnabled || this.guides.length === 0) {
      return { x, y, snappedX: false, snappedY: false };
    }

    let snappedX = x;
    let snappedY = y;
    let didSnapX = false;
    let didSnapY = false;

    for (const guide of this.guides) {
      if (guide.axis === "x" && !didSnapX) {
        const dist = Math.abs(x - guide.position);
        if (dist <= this.guideThreshold) {
          snappedX = guide.position;
          didSnapX = true;
        }
      }
      if (guide.axis === "y" && !didSnapY) {
        const dist = Math.abs(y - guide.position);
        if (dist <= this.guideThreshold) {
          snappedY = guide.position;
          didSnapY = true;
        }
      }
    }

    return { x: snappedX, y: snappedY, snappedX: didSnapX, snappedY: didSnapY };
  }

  /**
   * Combined snap: grid first, then guides.
   */
  snap(x: number, y: number): SnapResult {
    const gridResult = this.snapToGrid(x, y);
    const guideResult = this.snapToGuides(gridResult.x, gridResult.y);

    return {
      x: guideResult.x,
      y: guideResult.y,
      snappedX: gridResult.snappedX || guideResult.snappedX,
      snappedY: gridResult.snappedY || guideResult.snappedY,
    };
  }

  /**
   * Get all current guides.
   */
  getGuides(): Guide[] {
    return [...this.guides];
  }
}
