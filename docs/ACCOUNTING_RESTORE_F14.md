# F14 : sauvegarde et restauration de la comptabilité personnelle

**Décision proposée, pas une fonction livrée.** Priorité à une restauration locale volontaire, testée avant de concevoir la synchronisation entre appareils. Un rapport ne constitue pas une sauvegarde et un export de réglages ne remplace pas les transactions sources. La copie partagée au connecteur est destinée à ses lectures ; ce n’est ni une source de vérité ni une solution de restauration.

## Ce qui doit être conservé

| Famille de réglages actuels | Contenu à conserver | Dépendances à vérifier avant restauration |
| --- | --- | --- |
| Classement | `mapping`, `inferredMapping`, `classificationVersion`, `mappingBeforeDetailedChart`, `walletAccounts` | Anciens codes, distinction Auto/manuel, réaffectations bancaires et références de comptes |
| Compléments | `balances`, `equityMode` | Devises, dates et montants déclarés ; les notes libres restent privées |
| Dettes | `debts`, `archivedDebts` | Capital, mouvements, ajustements, détachements et historique ; contrôler les références aux opérations et biens |
| Rattachements | `positions`, `assetLinks`, `positionAudit` | Identifiants stables, dates et devises, absence de double attribution ; distinguer les traces historiques des rattachements actifs |

Un futur format descriptif inclura une version de sauvegarde distincte de `classificationVersion`, l’identité du compte et du voyage, la date de création et les familles validées ci-dessus. Il ne doit pas embarquer de transactions, soldes bancaires calculés, documents, taux ou rapports, ni de lien de téléchargement, secret ou jeton. Les notes comptables, montants déclarés et références restent des données privées même sans ces éléments. Pas de transfert silencieux vers un connecteur, une télémétrie ou un serveur.

## Parcours proposé

1. Export uniquement depuis le compte et voyage actifs, après que la personne a choisi de créer une copie privée. Aucun fichier ni partage automatique. Un fichier en clair ne doit pas être présenté comme sécurisé ; examiner les options de protection et annoncer le format avant de le rendre disponible.
2. Ouvrir la sauvegarde en lecture seule. Limiter taille et profondeur ; valider version et champs imbriqués, sans écraser une copie locale illisible ni accepter un changement de compte/voyage. Ne pas repointer les identifiants par ressemblance. Recharger les données sources autorisées pour distinguer « source manquante » de « lecture indisponible », et empêcher une restauration confirmée sur une lecture incomplète.
3. Montrer les familles qui seraient remplacées et les références manquantes ou incompatibles, sans inventer de zéro. Ne pas remplacer silencieusement une version locale : demander un choix explicite ou annuler, et garder l’ancienne version récupérable. Le premier parcours doit préserver les correspondances intactes et refuser le remplacement si des liens actifs ne peuvent pas être vérifiés.
4. Vérifier de nouveau compte, voyage et version locale après la confirmation. Appliquer en une seule écriture locale, sans modifier les sources. En cas de conflit d’onglet, d’espace insuffisant ou de fermeture, la version précédente doit rester disponible. Le contrôle local actuel repère une modification déjà faite mais n’est pas transactionnel entre deux onglets simultanés ; ne pas annoncer cette garantie avant de la tester.

## Première validation, hors interface

Le prototype interne `previewAccountingRestore` ne lit ni le stockage ni le réseau.
Il refuse un JSON invalide ou trop volumineux (500 000 octets), un périmètre absent
ou différent, une version inconnue, un horodatage invalide et un jeu de familles
absent, incomplet ou de type inattendu. La profondeur des réglages est limitée.
Le résultat indique uniquement la date et les familles examinées, sans valeurs
comptables ni identifiants. « Périmètre contrôlé » ne signifie pas « restaurable » :
les champs détaillés, la compatibilité métier des liens, l’état local et les
conflits ne sont pas encore évalués. Avec un inventaire complet du même compte
et voyage fourni séparément, le prototype vérifie la présence des références
actives (comptes, biens, opérations d’origine, remboursements et positions).
Il distingue un inventaire indisponible d’une référence absente et ne retourne
que des nombres par type. Il bloque aussi le double rattachement d’une même transaction active (origine ou remboursement de dette, position ou achat lié à un bien) et ne renvoie que le nombre d’opérations concernées. Une référence de bien partagée et les traces historiques ne comptent pas comme un double rattachement. Sur inventaire typé, le prototype vérifie aussi le type et la devise des opérations d’origine, des remboursements et des positions : il distingue les incompatibilités des métadonnées incomplètes et ne renvoie que le nombre d’opérations incompatibles. Il exige aussi un montant source positif, strictement égal au capital pour l’origine (un arrondi identique au centime ne suffit pas), et suffisant pour couvrir le principal d’un remboursement selon la comparaison en centimes du registre. L’inventaire typé précise le jour de contrôle et, pour chaque opération, sa date de trésorerie et son état de règlement explicite. Le jour de contrôle et les dates d’ouverture sont inclusifs : l’origine peut précéder l’ouverture, le remboursement ne peut pas, et une opération non réglée ou future ne valide pas le lien. Pour les achats de biens, l’inventaire typé exige aussi les métadonnées fiables du bien : dépense réglée, devise cohérente et montant identique au centime, date d’achat non future. Le résultat ne renvoie que le nombre d’opérations incompatibles. Le cumul des remboursements est vérifié dans l’aperçu typé, à partir d’un capital de départ positif et des dates de trésorerie des sources déjà contrôlées. Les ajustements valides passent avant les remboursements du même jour, comme dans le registre : un capital négatif à un moment donné reste incompatible même si un ajustement postérieur le comble. Le résultat ne donne que le nombre de dettes concernées, sans montants, identifiants ni motifs. Les dettes archivées ne participent pas à ce calcul. L’aperçu typé requiert aussi une classification explicite des virements dans les métadonnées source : drapeau interne et identifiant de transfert (ou null attesté). Un identifiant de transfert exclut la ligne de tous les rattachements actifs. Si seul le drapeau interne est présent, les champs de qualification Trip et budget doivent être fournis ; la règle comptable existante distingue alors une quote-part d’un virement. Une qualification manquante rend la source indisponible, sans transformer une absence de preuve en mouvement ordinaire. Pour une origine de dette ou un remboursement, la source doit fournir l’identifiant de l’opération Trip (ou null) et un indicateur explicite de paiement Trip détaché. Comme le registre, l’aperçu exclut les paiements Trip, même détachés. Sans l’un de ces champs la source est indisponible. Cette règle ne transforme pas les quotes-parts budgétaires en virements et ne change pas le contrôle des positions. Le rapprochement avec les liens serveur et l’éligibilité complète des autres opérations restent à vérifier. Rien n’est écrit, importé, exporté ou publié.

## Porte de sortie avant synchronisation

La restauration doit réussir entre deux contextes fictifs du même compte et voyage, et refuser autre compte, autre voyage, version inconnue, format partiel, références actives incompatibles, écriture obsolète et quota plein. La preuve de domaine ci-jointe vérifie le recalcul avec des sources identiques, l’indisponibilité après disparition d’un remboursement et l’isolation des clés locales. Elle n’implémente ni le fichier ni l’interface de restauration.

Pour une synchronisation ultérieure, concevoir un stockage authentifié distinct, avec révision conditionnelle par compte/voyage, reprise idempotente et conflit explicite entre appareils. La version initiale du navigateur ne doit jamais gagner par défaut contre un état distant existant. Tester aussi suppression de compte, révocation, rétention, export des données et absence de partage MCP automatique avant toute activation distante.
