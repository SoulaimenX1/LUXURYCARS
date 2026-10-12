# Diagrammes de classes — LUXURY CARS

## Fichiers

| Fichier | Description |
| --- | --- |
| `class-diagram-complet.puml` | **Diagramme de classes complet** : entités, DTO, services, contrôleurs, sécurité, frontend (lib, routes API proxy, composants, pages) |
| `class-diagram-domaine.puml` | **Diagramme du domaine** : uniquement les entités + énumérations + relations (déjà fait / à réaliser) |
| `LUXURY_CARS_Class_Diagram.png` / `.svg` | Rendu du diagramme complet |
| `LUXURY_CARS_Domain_Class_Diagram.png` / `.svg` | Rendu du diagramme du domaine |
| `vendor/plantuml.jar` | PlantUML (21 Mo) pour re-rendre hors-ligne — peut être supprimé |

## Conventions

- Classes pleines = **déjà réalisé** (mappées par l'application).
- Classes `<<à réaliser>>` = tables prévues dans `schema.sql` mais dont la
  fonctionnalité applicative n'est pas encore développée.

## Regénérer les images

Nécessite Java 17+ et Graphviz (`dot`).

```powershell
cd docs/diagrams

# Vérifier la syntaxe
java -jar vendor/plantuml.jar -checkonly class-diagram-complet.puml
java -jar vendor/plantuml.jar -checkonly class-diagram-domaine.puml

# Générer PNG et SVG
java -jar vendor/plantuml.jar -tpng class-diagram-complet.puml class-diagram-domaine.puml
java -jar vendor/plantuml.jar -tsvg class-diagram-complet.puml class-diagram-domaine.puml
```

Sans `plantuml.jar` local, utiliser le serveur en ligne :
<https://www.plantuml.com/plantuml/uml/> (coller le contenu du `.puml`).

## Rendu depuis VS Code

Installer l'extension **PlantUML** (`jebbs.plantuml`) puis `Alt + D` pour prévisualiser.
