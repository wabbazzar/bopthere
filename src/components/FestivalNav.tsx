import React, { useState, useEffect, useRef } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { characterThemes } from '@/types/character';
import { Button } from '@/components/ui/button';
import { Calendar, Bed, Users, Gamepad, Image, LogOut, Menu, X } from 'lucide-react';
import { FestivalTab } from '@/pages/Festival';
import { navDebugger } from '@/utils/navDebugger';

interface FestivalNavProps {
  activeTab: FestivalTab;
  onTabChange: (tab: FestivalTab) => void;
}

interface TabConfig {
  id: FestivalTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'itinerary',
    label: 'Itinerary',
    icon: Calendar,
    description: 'Your wedding weekend schedule',
  },
  {
    id: 'sleeping',
    label: 'Sleeping',
    icon: Bed,
    description: 'Your accommodation details',
  },
  {
    id: 'guests',
    label: 'Guest List',
    icon: Users,
    description: "See who's joining the celebration",
  },
  {
    id: 'games',
    label: 'Games',
    icon: Gamepad,
    description: 'Fun activities and challenges',
  },
  {
    id: 'photos',
    label: 'Photos',
    icon: Image,
    description: 'View and share wedding photos',
  },
];

export const FestivalNav: React.FC<FestivalNavProps> = ({ activeTab, onTabChange }) => {
  const { selectedCharacter } = useCharacter();
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const menuStateRef = useRef(isMobileMenuOpen);

  // Track viewport width to handle DevTools opening/closing
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      // Auto-close mobile menu if viewport expands beyond mobile breakpoint
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  // Debug logging for component lifecycle and state
  useEffect(() => {
    navDebugger.log('FestivalNav', 'component-mounted', {
      activeTab,
      selectedCharacter,
      isAuthenticated: !!user,
      isMobileMenuOpen,
    });

    // Ensure nav is always interactive
    const ensureNavInteractive = () => {
      const nav = document.querySelector('nav');
      if (nav) {
        (nav as HTMLElement).style.pointerEvents = 'auto';
      }
    };

    ensureNavInteractive();
    const interval = setInterval(ensureNavInteractive, 1000);

    return () => {
      clearInterval(interval);
      navDebugger.log('FestivalNav', 'component-unmounted');
    };
  }, [activeTab, selectedCharacter, user, isMobileMenuOpen]);

  useEffect(() => {
    menuStateRef.current = isMobileMenuOpen;
    navDebugger.log(
      'FestivalNav',
      'state-changed',
      {
        isMobileMenuOpen,
        user: user?.full_name || 'not logged in',
      },
      hamburgerRef.current
    );
  }, [isMobileMenuOpen, user]);

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];

  const handleTabClick = (tabId: FestivalTab) => {
    navDebugger.log('FestivalNav', 'tab-click', {
      tabId,
      previousTab: activeTab,
      isMobileMenuOpen,
    });
    onTabChange(tabId);
    setIsMobileMenuOpen(false); // Close mobile menu after selection
  };

  const handleLogout = () => {
    navDebugger.log('FestivalNav', 'logout-clicked', {
      user: user?.full_name,
      isMobileMenuOpen,
    });
    logout();
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 bg-black/20 backdrop-blur-md border-b border-white/20"
        style={{
          isolation: 'isolate',
          zIndex: 9999,
          pointerEvents: 'auto', // Ensure nav is always clickable
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center">
              <h2
                className="text-xl font-bold text-white hidden sm:block"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Maui 2025
              </h2>
              <h2
                className="text-base font-bold text-white sm:hidden"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Maui 2025
              </h2>
            </div>

            {/* Desktop Tab Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;

                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? 'default' : 'ghost'}
                    onClick={() => handleTabClick(tab.id)}
                    className={`
                      relative transition-all duration-300 hover:scale-105
                      ${isActive ? 'shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}
                    `}
                    style={{
                      backgroundColor: isActive ? currentTheme.primary : 'transparent',
                      color: isActive ? 'white' : undefined,
                      pointerEvents: 'auto', // Ensure buttons are clickable
                      position: 'relative',
                      zIndex: 1,
                    }}
                    title={tab.description}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden lg:inline">{tab.label}</span>
                    <span className="lg:hidden">{tab.label.split(' ')[0]}</span>
                  </Button>
                );
              })}
            </div>

            {/* User info and logout */}
            <div className="flex items-center space-x-2">
              <div className="hidden sm:block text-right">
                <p className="text-sm text-white/90 truncate max-w-[150px]">{user?.full_name}</p>
                <p className="text-xs text-white/70 capitalize">{user?.role}</p>
              </div>

              {/* Desktop Logout */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hidden md:flex items-center transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: currentTheme.secondary,
                  color: 'white',
                  backgroundColor: 'transparent',
                }}
                title="Logout"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                ref={hamburgerRef}
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navDebugger.log(
                    'FestivalNav',
                    'hamburger-click-attempt',
                    {
                      currentState: menuStateRef.current,
                      eventType: e.type,
                      eventTarget: e.currentTarget.tagName,
                      isDefaultPrevented: e.defaultPrevented,
                    },
                    e.currentTarget
                  );
                  const newState = !menuStateRef.current;
                  menuStateRef.current = newState;
                  setIsMobileMenuOpen(newState);
                }}
                onPointerDown={(e) => {
                  navDebugger.log(
                    'FestivalNav',
                    'hamburger-pointer-down',
                    {
                      pointerType: e.pointerType,
                      isPrimary: e.isPrimary,
                    },
                    e.currentTarget
                  );
                }}
                className="md:hidden text-white hover:bg-white/10 relative"
                key="hamburger-menu-button"
                style={{ zIndex: 110, pointerEvents: 'auto', position: 'relative' }}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && viewportWidth < 768 && (
        <div className="fixed inset-0" style={{ isolation: 'isolate', zIndex: 90 }}>
          <div
            className="fixed inset-0 bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              navDebugger.log('FestivalNav', 'backdrop-clicked');
              menuStateRef.current = false;
              setIsMobileMenuOpen(false);
            }}
          />
          <div className="fixed top-16 left-0 right-0 bg-black/20 backdrop-blur-md border-b border-white/20">
            <div className="container mx-auto px-4 py-4">
              {/* Mobile user info */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/20">
                <div>
                  <p className="text-white font-medium">{user?.full_name}</p>
                  <p className="text-white/70 text-sm capitalize">{user?.role}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="transition-all duration-300"
                  style={{
                    borderColor: currentTheme.secondary,
                    color: 'white',
                    backgroundColor: 'transparent',
                  }}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </div>

              {/* Mobile tab navigation */}
              <div className="grid grid-cols-2 gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTab;

                  return (
                    <Button
                      key={tab.id}
                      variant={isActive ? 'default' : 'ghost'}
                      onClick={() => handleTabClick(tab.id)}
                      className={`
                        flex flex-col items-center justify-center h-20 transition-all duration-300
                        ${
                          isActive
                            ? 'shadow-lg'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }
                      `}
                      style={{
                        backgroundColor: isActive ? currentTheme.primary : 'transparent',
                        color: isActive ? 'white' : undefined,
                      }}
                    >
                      <Icon className="w-6 h-6 mb-1" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
