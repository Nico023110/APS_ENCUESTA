# Pruebas

    node pruebas/reglas.test.js       # 50 casos — motor de reglas (sin DOM)
    node pruebas/formulario.test.js   # 83 casos — formulario en DOM (requiere jsdom)

`formulario.test.js` necesita jsdom:

    npm install jsdom
