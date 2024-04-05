const { nextui } = require('@nextui-org/react')
module.exports = {
    // increase css specificity
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'],
    // important: 'body',
    darkMode: 'class',
    plugins: [nextui()],
}
