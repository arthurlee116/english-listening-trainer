import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// all in fixtures is set to tailwind v3 as interims solutions

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: {
  				DEFAULT: 'hsl(var(--background))',
  				subtle: 'hsl(var(--background-subtle))',
  				panel: 'hsl(var(--background-panel))',
  				app: 'hsl(var(--background))', // For main app background
  				content: 'hsl(var(--background-subtle))' // For content areas
  			},
  			foreground: {
  				DEFAULT: 'hsl(var(--foreground))',
  				secondary: 'hsl(var(--foreground-secondary))',
  				tertiary: 'hsl(var(--foreground-tertiary))',
  				muted: 'hsl(var(--foreground-muted))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				light: 'hsl(var(--primary-light))',
  				border: 'hsl(var(--primary-border))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				border: 'hsl(var(--secondary-border))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				light: 'hsl(var(--destructive-light))',
  				border: 'hsl(var(--destructive-border))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: {
  				DEFAULT: 'hsl(var(--border))',
  				subtle: 'hsl(var(--border-subtle))',
  				emphasis: 'hsl(var(--border-emphasis))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			brand: {
  				lightBackground: 'hsl(var(--background-panel))',
  				lightPrimary: 'hsl(var(--primary))',
  				lightSecondary: 'hsl(var(--secondary))',
  				lightBorder: 'hsl(var(--border))',
  				lightText: 'hsl(var(--foreground))',
  				lightTextSecondary: 'hsl(var(--foreground-secondary))',
  				lightTextTertiary: 'hsl(var(--foreground-tertiary))',
  				lightTextMuted: 'hsl(var(--foreground-muted))'
  			},
  			button: {
  				light: {
  					primary: 'hsl(var(--primary))',
  					secondary: 'hsl(var(--button-secondary-bg))',
  					destructive: 'hsl(var(--button-destructive-bg))',
  					outline: 'hsl(var(--background))'
  				}
  			},
  			glass: {
  				light: 'rgba(255, 255, 255, 0.85)',
  				dark: 'rgba(31, 41, 55, 0.7)'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		// Theme-specific utilities
  		utilities: {
  			'.theme-light-bg': {
  				'background-color': 'hsl(var(--background))'
  			},
  			'.theme-light-panel': {
  				'background-color': 'hsl(var(--background-panel))'
  			},
  			'.theme-light-text': {
  				'color': 'hsl(var(--foreground))'
  			},
  			'.theme-light-border': {
  				'border-color': 'hsl(var(--border))'
  			}
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
