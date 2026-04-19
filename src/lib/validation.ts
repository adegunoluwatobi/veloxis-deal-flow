export interface ValidationRule {
  fieldId: string;
  label: string;
  condition: boolean;
}

export interface ValidationFailure {
  fieldId: string;
  label: string;
}

/**
 * Validate a list of rules. Returns failures if any, or empty array if all pass.
 * When there are failures:
 * - Scrolls to first failing field
 * - Adds temporary red highlight to all failing fields
 * - Returns the list of failures for display in a banner
 */
export function validateAndScroll(rules: ValidationRule[]): ValidationFailure[] {
  const failures = rules.filter(r => !r.condition).map(r => ({
    fieldId: r.fieldId,
    label: r.label,
  }));

  if (failures.length === 0) return [];

  // Highlight all failing fields
  failures.forEach(f => {
    const el = document.getElementById(f.fieldId);
    if (el) {
      el.classList.add('validation-error-highlight');
      // Also add inline error text if not already present
      const existingError = el.parentElement?.querySelector('.validation-inline-error');
      if (!existingError) {
        const errorText = document.createElement('p');
        errorText.className = 'validation-inline-error text-xs mt-1';
        errorText.style.color = 'hsl(var(--destructive))';
        errorText.textContent = `${f.label} is required`;
        el.parentElement?.appendChild(errorText);
      }
      // Remove highlight after 3 seconds
      setTimeout(() => {
        el.classList.remove('validation-error-highlight');
        const inlineErr = el.parentElement?.querySelector('.validation-inline-error');
        inlineErr?.remove();
      }, 5000);
    }
  });

  // Scroll to + focus first failing field so the cursor lands in it immediately
  const firstEl = document.getElementById(failures[0].fieldId) as HTMLElement | null;
  if (firstEl) {
    setTimeout(() => {
      firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the field (or the first focusable child if it's a wrapper)
      const focusTarget: HTMLElement | null =
        typeof (firstEl as any).focus === 'function' && firstEl.tabIndex !== -1 && (
          firstEl.tagName === 'INPUT' ||
          firstEl.tagName === 'TEXTAREA' ||
          firstEl.tagName === 'SELECT' ||
          firstEl.tagName === 'BUTTON' ||
          firstEl.isContentEditable
        )
          ? firstEl
          : firstEl.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
            );
      try {
        focusTarget?.focus({ preventScroll: true });
        // For text inputs, place caret at the end
        const el = focusTarget as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && 'setSelectionRange' in el && typeof el.value === 'string') {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      } catch {
        /* ignore focus errors (e.g. non-focusable element) */
      }
    }, 150);
  }

  return failures;
}

/**
 * Build a prerequisite tooltip string for buttons that require conditions to be met.
 * Returns null if all conditions are met (button is ready).
 */
export function buildPrerequisiteTooltip(rules: ValidationRule[]): string | null {
  const missing = rules.filter(r => !r.condition);
  if (missing.length === 0) return null;
  return `Still needed:\n${missing.map(r => `• ${r.label}`).join('\n')}`;
}
