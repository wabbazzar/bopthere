/**
 * Prevent buttons from being inadvertently disabled
 */
export function preventButtonDisabling() {
  // Override setAttribute to prevent disabled being set on navigation buttons
  const originalSetAttribute = Element.prototype.setAttribute;
  
  Element.prototype.setAttribute = function(name: string, value: string) {
    // Prevent setting disabled on navigation buttons
    if (name === 'disabled' && this.tagName === 'BUTTON') {
      const isNavButton = 
        this.closest('nav') || 
        this.closest('[class*="FestivalNav"]') ||
        this.closest('[class*="CharacterSwitcher"]') ||
        this.hasAttribute('key'); // Our nav buttons have keys
        
      if (isNavButton) {
        console.warn('Prevented disabling navigation button:', this);
        return;
      }
    }
    
    return originalSetAttribute.call(this, name, value);
  };
  
  // Remove any existing disabled attributes from nav buttons
  const navButtons = document.querySelectorAll('nav button, [class*="FestivalNav"] button, [class*="CharacterSwitcher"] button');
  navButtons.forEach(button => {
    if (button.hasAttribute('disabled')) {
      button.removeAttribute('disabled');
      console.warn('Removed disabled from nav button:', button);
    }
  });
}