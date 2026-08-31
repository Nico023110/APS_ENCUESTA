import re
with open('c:/proyecto/poblacion_x_rips/services/motor_reglas.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove total_actividades += 1 from where it currently is, and conditionally add it
content = content.replace(
    'total_actividades += 1\n                edad_valor, edad_unidad',
    'if not getattr(actividad, \"informativo\", False):\n                    total_actividades += 1\n                edad_valor, edad_unidad'
)

# Update the classification block
old_block = '''                # Clasificar resultado
                if evidencia_valida:
                    estado = "CUMPLIDA_COHORTE"
                    total_cumplidas += 1
                    detalle = None
                else:
                    estado = "PENDIENTE_COHORTE"
                    total_pendientes += 1
                    detalle = ('''
new_block = '''                # Clasificar resultado
                if evidencia_valida:
                    estado = "CUMPLIDA_COHORTE"
                    if not getattr(actividad, "informativo", False):
                        total_cumplidas += 1
                    detalle = None
                else:
                    if getattr(actividad, "informativo", False):
                        estado = "NO_REALIZADA_INFORMATIVA"
                        detalle = None
                    else:
                        estado = "PENDIENTE_COHORTE"
                        total_pendientes += 1
                        detalle = ('''

content = content.replace(old_block, new_block)

with open('c:/proyecto/poblacion_x_rips/services/motor_reglas.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated motor_reglas.py')
