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

  // Scroll to first failing field
  const firstEl = document.getElementById(failures[0].fieldId);
  if (firstEl) {
    setTimeout(() => {
      firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
