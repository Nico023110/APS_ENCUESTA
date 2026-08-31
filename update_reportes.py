import re
with open('c:/proyecto/poblacion_x_rips/services/generador_reportes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fetch actividades informativas
patch_1 = '''
        # Consultar resultados agrupados por actividad
        actividades_info = {a.nombre for a in db.query(Actividad).filter_by(informativo=True).all()} if hasattr(Actividad, "informativo") else set()
        
        resultados = ('''
content = content.replace('        # Consultar resultados agrupados por actividad\n        resultados = (', patch_1)

# 2. Update semaforo
old_semaforo = '''            if pct_cumplimiento < Config.SEMAFORO_CRITICO:
                semaforo = "CRTICO"
            elif pct_cumplimiento < Config.SEMAFORO_ALERTA:
                semaforo = "ALERTA"
            else:
                semaforo = "BUENO"'''
new_semaforo = '''            if r.actividad_nombre in actividades_info:
                semaforo = "INFORMATIVO"
            else:
                if pct_cumplimiento < Config.SEMAFORO_CRITICO:
                    semaforo = "CRTICO"
                elif pct_cumplimiento < Config.SEMAFORO_ALERTA:
                    semaforo = "ALERTA"
                else:
                    semaforo = "BUENO"'''
content = content.replace(old_semaforo, new_semaforo)

# We need to import Actividad
if 'from models.regla import Actividad' not in content:
    content = content.replace('from models.evaluacion import Evaluacion', 'from models.regla import Actividad\nfrom models.evaluacion import Evaluacion')

# 3. For resumen_curso_vida: we need to join Actividad to filter out informative from total_atenciones_necesarias?
# Actually, total_atenciones_necesarias in curso_vida should probably exclude informative activities.
patch_curso_vida = '''        resultados = (
            db.query(
                ResultadoActividad.persona_curso_vida,
                func.count(distinct(ResultadoActividad.persona_documento)).label("pacientes_unicos"),
                func.count(distinct(ResultadoActividad.actividad_nombre)).label("actividades_aplicables"),
                func.sum(case((Actividad.informativo == False, 1), else_=0)).label("total_atenciones_necesarias"),
                func.sum(case(
                    (ResultadoActividad.estado == "PENDIENTE_COHORTE", 1),
                    else_=0
                )).label("pendientes_cohorte"),
            )
            .join(Actividad, Actividad.id == ResultadoActividad.actividad_id)
            .filter(ResultadoActividad.evaluacion_id == evaluacion.id)
            .group_by(ResultadoActividad.persona_curso_vida)
            .all()
        )'''
# Replace the old query in generar_resumen_curso_vida
old_curso_vida = '''        resultados = (
            db.query(
                ResultadoActividad.persona_curso_vida,
                func.count(distinct(ResultadoActividad.persona_documento)).label("pacientes_unicos"),
                func.count(distinct(ResultadoActividad.actividad_nombre)).label("actividades_aplicables"),
                func.count(ResultadoActividad.id).label("total_atenciones_necesarias"),
                func.sum(case(
                    (ResultadoActividad.estado == "PENDIENTE_COHORTE", 1),
                    else_=0
                )).label("pendientes_cohorte"),
            )
            .filter_by(evaluacion_id=evaluacion.id)
            .group_by(ResultadoActividad.persona_curso_vida)
            .all()
        )'''
content = content.replace(old_curso_vida, patch_curso_vida)

with open('c:/proyecto/poblacion_x_rips/services/generador_reportes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated generador_reportes.py')
