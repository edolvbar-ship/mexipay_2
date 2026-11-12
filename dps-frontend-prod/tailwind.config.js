/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    fontFamily: {
      'sans': ['Archivo Narrow']
    },
    extend: {
      rotate: {
        '270': '270deg', 
      },
    },
    colors: {
      'light-primary': 'rgba(12, 71, 114, 0.1)',
      'primary': '#0C4772',
      'black': '#3C3C3B',
      'blue': '#3D6C8E',
      'light-gray': '#CFCFCF',
      'gray': '#9F9F9F',
      'green': '#87F9A4',
      'red': '#FF5F5F',
      'yellow': '#F9E887',
      'white': '#ffffff',
    },
  },
  variants: {
    extend: {
      placeholderColor: ['focus'],
    },
  },
  plugins: [],
}
