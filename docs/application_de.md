# Bewerbung – Textbausteine

## Anschreiben (Absatz)

Um Ihnen nicht nur zu beschreiben, wie ich arbeite, sondern es zu zeigen, habe ich vorab einen kleinen Prototyp gebaut: **K2 Base Lite**, einen vereinfachten Konfigurator für PV-Montagesysteme auf Schrägdächern ([Demo-Link], Quellcode: [GitHub-Link]). Nutzer geben Modulfeld, Dachneigung sowie Wind- und Schneezone ein, sehen eine 3D-Vorschau und erhalten eine Stückliste mit Gesamtleistung, Schienenlänge und Gewicht. Technisch steht dahinter eine Django/DRF-API mit pytest-Tests, ein React-Frontend mit react-three-fiber, eine CI/CD-Pipeline mit GitHub Actions, Docker-Images und Kubernetes-Manifeste mit Health-Probes und Autoscaling. Die Architektur ist nach arc42 dokumentiert, Entscheidungen halte ich in ADRs fest – darunter eine Make-or-Buy-Abwägung für Keycloak als OAuth2/OIDC-Identity-Provider. Wichtig ist mir dabei Transparenz: Die Artikelnummern sind Platzhalter, die Lastprüfung ist eine bewusst vereinfachte Abschätzung und ersetzt keine Statik nach EN 1991, und das Projekt steht in keiner Verbindung zu K2 Systems. Gerne bespreche ich mit Ihnen, wie ich diese Arbeitsweise – klare Schnittstellen, Testautomatisierung, nachvollziehbare Architekturentscheidungen und Code-Reviews als Mentoring-Werkzeug – in Ihr Team einbringen kann.

## LinkedIn-Nachricht (kurz)

Hallo [Name], ich habe mich als Senior Software Engineer / Tech Lead bei K2 Systems beworben. Als Arbeitsprobe habe ich einen kleinen PV-Montage-Konfigurator gebaut (Django, React/3D, CI/CD, Kubernetes, arc42 + ADRs): [Demo-Link] · [GitHub-Link]. Platzhalterdaten, vereinfachte Lastabschätzung, keine Verbindung zu K2. Über einen kurzen Austausch würde ich mich sehr freuen!
