const { test, expect } = require('@playwright/test');

test('Diligenciar encuesta en Vercel paso a paso', async ({ page }) => {
  // Configurar un tiempo de espera amplio para permitir la visualización
  test.setTimeout(120000);

  console.log('Abriendo la página...');
  await page.goto('https://aps-encuesta.vercel.app/');
  await page.waitForTimeout(2000); // Pausa inicial

  // 1. Ir a "Nueva Encuesta"
  console.log('Iniciando nueva encuesta...');
  await page.click('button[data-view="nueva"]');
  await page.waitForTimeout(1500);
  
  // 2. Consentimiento -> SÍ
  console.log('Aceptando consentimiento...');
  await page.locator('input[name="consentimiento"][value="si"]').check();
  await page.waitForTimeout(1500);

  // 3. Llenar algunos campos de texto simulando escritura humana
  console.log('Digitando Equipo de Salud...');
  await page.locator('#equipoSaludId').click();
  await page.locator('#equipoSaludId').pressSequentially('EQ1234', { delay: 200 });
  await page.waitForTimeout(1000);

  console.log('Digitando Código de ficha...');
  await page.locator('#codigoFicha').click();
  await page.locator('#codigoFicha').pressSequentially('F-2024-APS', { delay: 200 });
  await page.waitForTimeout(1000);

  console.log('Seleccionando fecha...');
  await page.locator('#fechaDiligenciamiento').fill('2026-08-27');
  await page.waitForTimeout(1000);

  console.log('Digitando Institución...');
  await page.locator('#nombreInstitucion').click();
  await page.locator('#nombreInstitucion').pressSequentially('Clínica Central', { delay: 150 });
  await page.waitForTimeout(1000);

  console.log('Digitando Cabeza de Familia...');
  await page.locator('#cabezaFamilia').click();
  await page.locator('#cabezaFamilia').pressSequentially('Carlos Martínez', { delay: 150 });
  await page.waitForTimeout(1500);

  // Intentar guardar para ver las validaciones (errores que impiden completar)
  console.log('Haciendo clic en Guardar encuesta para verificar errores de validación...');
  await page.locator('#btnGuardar').click();
  
  // Esperar un momento para que se rendericen los errores
  await page.waitForTimeout(3000);

  // Identificar errores que impidan completar la encuesta
  const errores = await page.evaluate(() => {
    // Buscar alertas visibles o campos inválidos
    const alertas = Array.from(document.querySelectorAll('.alert:not([hidden])')).map(el => el.textContent.trim());
    const invalidInputs = Array.from(document.querySelectorAll('input:invalid, select:invalid, [aria-invalid="true"]')).map(el => {
      const label = el.closest('.field')?.querySelector('label')?.textContent;
      return label ? label.replace('*', '').trim() : el.name || el.id;
    });
    return { alertas, invalidInputs };
  });

  console.log('\n--- RESULTADO DE LA VALIDACIÓN ---');
  if (errores.alertas.length > 0) {
    console.log('Alertas visibles:');
    errores.alertas.forEach(a => console.log(`- ${a}`));
  }
  if (errores.invalidInputs.length > 0) {
    console.log(`Hay ${errores.invalidInputs.length} campos obligatorios sin diligenciar o con error. Algunos de ellos son:`);
    errores.invalidInputs.slice(0, 5).forEach(i => console.log(`- ${i}`));
    if (errores.invalidInputs.length > 5) console.log('... y otros más.');
  }

  if (errores.alertas.length === 0 && errores.invalidInputs.length === 0) {
    console.log('No se encontraron errores que impidan completar la encuesta.');
  } else {
    console.log('Se encontraron errores o campos faltantes que impiden completar la encuesta.');
  }
  
  // Pausa final para que el usuario pueda ver el estado antes de que se cierre
  await page.waitForTimeout(5000);
});
