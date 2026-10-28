/** Creates an element with a class, optional text, and parent. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

export function button(label: string, parent: HTMLElement, onClick: () => void, className = 'btn'): HTMLButtonElement {
  const node = el('button', className, parent, label);
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return node;
}

export function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
