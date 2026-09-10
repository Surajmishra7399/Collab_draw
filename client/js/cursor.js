/**
 * client/js/cursor.js
 * Remote Collaborative Cursors Rendering Engine
 */

export class CursorOverlay {
  constructor(overlayContainer) {
    this.container = overlayContainer;
    this.cursorElements = new Map(); // userId -> DOMElement
  }

  /**
   * Update or create a remote user cursor
   */
  updateCursor(userId, username, userColor, x, y) {
    let cursorEl = this.cursorElements.get(userId);

    if (!cursorEl) {
      cursorEl = this.createCursorElement(userId, username, userColor);
      this.container.appendChild(cursorEl);
      this.cursorElements.set(userId, cursorEl);
    }

    // Update name or color if changed
    const tagEl = cursorEl.querySelector('.cursor-tag');
    if (tagEl && tagEl.dataset.username !== username) {
      tagEl.dataset.username = username;
      tagEl.textContent = username || 'User';
    }

    // Hardware-accelerated smooth positioning
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  /**
   * Create DOM markup for a remote cursor
   */
  createCursorElement(userId, username, color) {
    const el = document.createElement('div');
    el.className = 'remote-cursor';
    el.dataset.userId = userId;

    // SVG Pointer Arrow
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cursor-pointer');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', color);
    svg.setAttribute('stroke', '#ffffff');
    svg.setAttribute('stroke-width', '1.5');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z');
    svg.appendChild(path);

    // Name tag pill
    const tag = document.createElement('div');
    tag.className = 'cursor-tag';
    tag.style.backgroundColor = color;
    tag.dataset.username = username;
    tag.textContent = username || 'User';

    el.appendChild(svg);
    el.appendChild(tag);

    return el;
  }

  /**
   * Remove cursor when a user disconnects or leaves
   */
  removeCursor(userId) {
    const el = this.cursorElements.get(userId);
    if (el) {
      el.remove();
      this.cursorElements.delete(userId);
    }
  }

  /**
   * Clear all remote cursors
   */
  clear() {
    this.cursorElements.forEach((el) => el.remove());
    this.cursorElements.clear();
  }
}
