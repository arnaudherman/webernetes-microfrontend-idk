//! Équipe « calcul » — un fragment dont la logique est écrite en Rust.
//!
//! Ce que cette équipe démontre : l'indépendance de langage au niveau du CALCUL. Ce
//! module ne touche pas au DOM et ne le peut pas — WebAssembly n'y a pas accès, et
//! aucune proposition de standardisation n'est ouverte pour lui en donner. Le rendu
//! reste en JavaScript, ici comme partout.
//!
//! Deux fonctions exposées, délibérément :
//!
//!   agreger_json    reçoit et rend du JSON en chaîne. C'est l'approche naïve, celle
//!                   qu'on écrit d'abord, et elle paie une (dé)sérialisation à chaque
//!                   franchissement.
//!
//!   agreger_colonnes  reçoit des tableaux typés parallèles. Les nombres traversent
//!                     sans copie ni analyse syntaxique. C'est ce que coûte de
//!                     concevoir POUR la frontière au lieu de la subir.
//!
//! L'écart entre les deux est le vrai enseignement de ce fragment : le prix d'une
//! frontière ne dépend pas du langage, il dépend de la forme des données qu'on lui
//! fait traverser.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[derive(serde::Deserialize)]
struct Tache {
    statut: String,
    responsable: String,
    #[serde(rename = "chargeJours")]
    charge_jours: f64,
}

#[derive(serde::Serialize)]
struct Ligne {
    responsable: String,
    #[serde(rename = "nbTaches")]
    nb_taches: u32,
    #[serde(rename = "chargeJours")]
    charge_jours: f64,
    #[serde(rename = "aFaire")]
    a_faire: u32,
    #[serde(rename = "enCours")]
    en_cours: u32,
    termine: u32,
}

/// Approche naïve : JSON à l'aller, JSON au retour.
#[wasm_bindgen]
pub fn agreger_json(entree: &str) -> String {
    let taches: Vec<Tache> = match serde_json::from_str(entree) {
        Ok(v) => v,
        Err(e) => return format!("{{\"erreur\":\"{}\"}}", e),
    };

    let mut par_responsable: HashMap<String, Ligne> = HashMap::new();

    for tache in &taches {
        let ligne = par_responsable
            .entry(tache.responsable.clone())
            .or_insert_with(|| Ligne {
                responsable: tache.responsable.clone(),
                nb_taches: 0,
                charge_jours: 0.0,
                a_faire: 0,
                en_cours: 0,
                termine: 0,
            });
        ligne.nb_taches += 1;
        ligne.charge_jours += tache.charge_jours;
        match tache.statut.as_str() {
            "a-faire" => ligne.a_faire += 1,
            "en-cours" => ligne.en_cours += 1,
            _ => ligne.termine += 1,
        }
    }

    let mut lignes: Vec<Ligne> = par_responsable.into_values().collect();
    lignes.sort_by(|a, b| b.charge_jours.partial_cmp(&a.charge_jours).unwrap());
    serde_json::to_string(&lignes).unwrap_or_else(|_| "[]".into())
}

/// Approche conçue pour la frontière : des tableaux typés parallèles.
///
/// `responsables` et `statuts` sont des indices entiers dans des tables que
/// l'appelant conserve. Aucune chaîne ne traverse, aucun JSON n'est analysé.
/// Rend un tableau plat : pour chaque responsable, six valeurs consécutives.
#[wasm_bindgen]
pub fn agreger_colonnes(
    responsables: &[u32],
    statuts: &[u8],
    charges: &[f64],
    nb_responsables: u32,
) -> Vec<f64> {
    let n = nb_responsables as usize;
    let mut resultat = vec![0.0f64; n * 5];

    for i in 0..responsables.len() {
        let r = responsables[i] as usize;
        if r >= n {
            continue;
        }
        let base = r * 5;
        resultat[base] += 1.0; // nb de tâches
        resultat[base + 1] += charges[i]; // charge cumulée
        match statuts[i] {
            0 => resultat[base + 2] += 1.0, // à faire
            1 => resultat[base + 3] += 1.0, // en cours
            _ => resultat[base + 4] += 1.0, // terminé
        }
    }

    resultat
}

/// Rend la version du module, pour que le fragment puisse l'afficher.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
