import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveStyle(style: Record<string, string | number>): R;
      toHaveValue(value: string | number | string[]): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeVisible(): R;
      toBeEmptyDOMElement(): R;
      toContainElement(element: HTMLElement | SVGElement | null): R;
      toContainHTML(html: string): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
      toHaveFocus(): R;
      toHaveFormValues(values: Record<string, unknown>): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveErrorMessage(text?: string | RegExp): R;
    }
  }
}