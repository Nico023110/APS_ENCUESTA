/* =========================================================================
   APS APP — PERSONAL DE APOYO A VARIOS EBS
   Archivo 19 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   El equipo de enfoque diferencial no es un Equipo Básico de Salud: atiende
   determinadas comunas apoyando a los EBS que trabajan en ellas (2026-11-03).
   Como el anexo SI-APS exige en la variable 25 del tipo 2 el código de un EBS
   parametrizado en gestión técnica, sus fichas se firman con el EBS al que
   apoyan en esa visita.

   aps.funcionario_apoyo_ebs guarda a qué EBS apoya cada funcionario. Quien
   tiene filas aquí:
     · elige en el ítem 10 uno de esos EBS (y el suyo, si tiene);
     · ve y gestiona las fichas de esos EBS como si fuera parte de ellos.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

CREATE TABLE IF NOT EXISTS aps.funcionario_apoyo_ebs (
  funcionario_id  bigint NOT NULL REFERENCES aps.funcionario(id) ON DELETE CASCADE,
  equipo_salud_id bigint NOT NULL REFERENCES aps.equipo_salud(id),
  PRIMARY KEY (funcionario_id, equipo_salud_id)
);

COMMENT ON TABLE aps.funcionario_apoyo_ebs IS
  'EBS a los que apoya un funcionario sin pertenecer a ellos (enfoque diferencial). Firma el ítem 10 con uno '
  'de ellos y ve sus fichas.';

COMMIT;
