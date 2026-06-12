// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderInputView } from '../../src/ui/inputView';

describe('renderInputView', () => {
  it('renders paste box, file input, and analyze button', () => {
    const el = document.createElement('div');
    renderInputView(el, () => {});
    expect(el.querySelector('textarea')).toBeTruthy();
    expect(el.querySelector('input[type="file"]')).toBeTruthy();
    expect(el.querySelector('button#analyze-btn')).toBeTruthy();
  });
  it('invokes the callback with pasted text on analyze', () => {
    const el = document.createElement('div');
    let received: { title: string; text: string }[] = [];
    renderInputView(el, (texts) => { received = texts; });
    (el.querySelector('textarea') as HTMLTextAreaElement).value = 'I was born in Newgate.';
    (el.querySelector('#analyze-btn') as HTMLButtonElement).click();
    expect(received).toHaveLength(1);
    expect(received[0].text).toContain('Newgate');
  });
});
