import re
with open('c:/proyecto/poblacion_x_rips/scripts/init_all_rules.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update asegurar_actividad signature
content = content.replace(
    'def asegurar_actividad(db, nombre, cups):',
    'def asegurar_actividad(db, nombre, cups, informativo=False):\n    act = db.query(Actividad).filter_by(nombre=nombre).first()\n    if not act:\n        act = Actividad(nombre=nombre, informativo=informativo)\n        db.add(act)\n        db.flush()\n    else:\n        if act.informativo != informativo:\n            act.informativo = informativo\n            db.add(act)\n            db.flush()\n    return act'
)
# Remove the old body which is now part of the replacement
content = re.sub(
    r'def asegurar_actividad\(db, nombre, cups, informativo=False\):.*?return act\n    act = db.query\(Actividad\).filter_by\(nombre=nombre\).first\(\)\n    if not act:\n        act = Actividad\(nombre=nombre\)\n        db.add\(act\)\n        db.flush\(\)\n    return act',
    'def asegurar_actividad(db, nombre, cups, informativo=False):\n    act = db.query(Actividad).filter_by(nombre=nombre).first()\n    if not act:\n        act = Actividad(nombre=nombre, informativo=informativo)\n        db.add(act)\n        db.flush()\n    else:\n        if getattr(act, \"informativo\", False) != informativo:\n            act.informativo = informativo\n            db.add(act)\n            db.flush()\n    return act',
    content,
    flags=re.DOTALL
)

# Update the calls for sellantes
content = content.replace(
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Adolescencia", ["997102"])',
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Adolescencia", ["997102"], informativo=True)'
)
content = content.replace(
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Infancia", ["997102"])',
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Infancia", ["997102"], informativo=True)'
)
content = content.replace(
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Primera Infancia", ["997102"])',
    'act_sell = asegurar_actividad(db, "Aplicacion de sellantes - Primera Infancia", ["997102"], informativo=True)'
)

with open('c:/proyecto/poblacion_x_rips/scripts/init_all_rules.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated init_all_rules.py')
