# Sebenza translation review guide (isiZulu · isiXhosa · Afrikaans)

**For the human reviewer.** The full UI catalogs in `messages/zu.json`, `messages/xh.json` and
`messages/af.json` were AI-drafted on 2026-08-16 and need your review. This guide tells you what
to check, gives the glossary the drafts follow, and contains the **consent/POPIA/legal drafts
that are deliberately NOT live yet**: they stay English in the product until you sign them off.

## TASKS

- [ ] 1. Review the three catalogs (`messages/zu.json`, `messages/xh.json`, `messages/af.json`)
      for accuracy, tone, and natural phrasing. Edit directly in the files; anything between
      `{curly braces}` is code and must stay byte-for-byte identical (a test enforces this).
- [ ] 2. Review the **consent/legal drafts** in this document (the priority: they carry POPIA
      meaning). Correct them here first.
- [ ] 3. Sign off. Then the corrected consent blocks get pasted into the catalogs and the hold
      list in `lib/i18n/catalogs.test.ts` (`CONSENT_HOLD_PREFIXES`) is emptied in the same
      commit.
- [ ] 4. After sign-off: the "four languages" marketing claims and video V9 unblock.

## What to check

- **Register:** plain, warm, respectful; a matric-leaver on a phone must understand it. Not
  academic, not slangy.
- **Consistency:** the same term for the same concept everywhere (glossary below).
- **Never translate:** Sebenza, Talent Pulse, NQF, NSFAS, SETA, TVET, UNISA, INDLELA, SAQA,
  CIPC, POPIA, PAIA, CV, PDF, CSV, KYC, TOTP.
- **"South Africa" is NEVER translated** (founder decision, 2026-08-17). The country name stays
  "South Africa" in every language. isiZulu/isiXhosa attach connectives with a hyphen, the way
  SA media writes foreign names: e-South Africa, i-South Africa, lase-South Africa,
  wase-South Africa, base-South Africa. Afrikaans keeps grammatical derivatives (Suid-Afrikaanse,
  Suid-Afrikaner) but the standalone name is South Africa.
- **Code stays code:** `{name}`, `{count, plural, =1 {...} other {...}}` structures keep their
  braces and argument names exactly; only the human words inside translate.
- **No em-dashes** anywhere (house rule).

## Glossary the drafts follow (change it consistently if you disagree)

| English | isiZulu | isiXhosa | Afrikaans |
|---|---|---|---|
| job seeker | umfuni womsebenzi | umfuni womsebenzi | werksoeker |
| employer | umqashi | umqeshi | werkgewer |
| skill(s) | ikhono / amakhono | isakhono / izakhono | vaardigheid / vaardighede |
| profile | iphrofayela | iprofayile | profiel |
| search | sesha / ukusesha | khangela / ukhangelo | soek / soektog |
| verified | Kuqinisekisiwe | Iqinisekisiwe | Geverifieer |
| unverified | Akuqinisekisiwe | Ayiqinisekiswanga | Ongeverifieer |
| employment status | isimo somsebenzi | imeko yengqesho | indiensnemingstatus |
| province | isifundazwe | iphondo | provinsie |
| consent | imvume | imvume | toestemming |
| dashboard | ideshibhodi | ideshbhodi | beheerpaneel |
| Career compass | Ikhampasi yomsebenzi | Ikhampasi yomsebenzi | Loopbaankompas |

---

# THE HELD CONSENT / LEGAL DRAFTS (English is live until you approve these)

These correspond to `auth.seekerSignUp.step2` (the consent step), `seekerDash.privacy` (the
privacy centre with POPIA export/erasure), and the two ID-encryption hints. The English
originals are in `messages/en.json` at the same key paths.

## 1 · The consent step (`auth.seekerSignUp.step2`)

### isiZulu draft

- heading: "Imvume yakho ibalulekile"
- subhead: "Iphrofayela yakho ayisesheki uze usho ukuthi ingasesheka. Ungahoxisa imvume noma nini esikhungweni sakho sobumfihlo."
- next: "Nikeza imvume uqhubeke"
- purposes.searchability: "Ukusesheka" · contact_reveal: "Ukuvezwa kokuxhumana" · document_sharing: "Ukwabelana ngamadokhumenti" · analytics_aggregate: "Izibalo ezihlanganisiwe" · outcomes_research: "Ucwaningo lwemiphumela" · vacancy_matching: "Izimemo zezikhala"
- purposeDetails.searchability: "Vumela abaqashi bangithole ngekhono nangendawo."
- purposeDetails.contact_reveal: "Abaqashi abaqinisekisiwe bangacela imininingwane yami yokuxhumana. Konke ukuvezwa kuyarekhodwa."
- purposeDetails.document_sharing: "Abaqashi abaqinisekisiwe bangacela iziqu zami engizilayishile."
- purposeDetails.analytics_aggregate: "Ngibale ezibalweni zikazwelonke zezomsebenzi. Akukho datha yami eyabiwayo."
- purposeDetails.outcomes_research: "Ngifake ezibalweni zeqembu ezisuka emfundweni ziye emsebenzini. Azilokothi ziveze muntu."
- purposeDetails.vacancy_matching: "Abaqashi abaqinisekisiwe bangangimaka esikhaleni esithile esinegama."
- groups.employers: "Abangakwenza abaqashi" · groups.employersHint: "Kokuthathu kuyazikhethelwa. Konke ukufinyelela kungokwabaqashi abaqinisekisiwe kuphela futhi kuyarekhodwa."
- groups.statistics: "Ngibale ezibalweni zikazwelonke" · groups.statisticsHint: "Okuzikhethelayo. Kuhlanganisiwe kuphela. Akulokothi kukuveze."
- required: "Kuyadingeka ukuze iphrofayela yakho ivele emiphumeleni yokusesha."
- terms.agreePrefix: "Ngiyavuma" · terms.termsLink: "Imigomo Yosebenzo" · terms.and: "kanye" · terms.privacyLink: "Inqubomgomo Yobumfihlo"
- terms.hint: "Imigomo imbandakanya i-akhawunti yakho nokusetshenziswa okwamukelekile. Izinketho zemvume ezingenhla zihlala zihoxiseka ngazinye esikhungweni sakho sobumfihlo."

### isiXhosa draft

- heading: "Imvume yakho ibalulekile"
- subhead: "Iprofayile yakho ayikhangeleki de utsho ukuba ingakhangeleka. Ungayirhoxisa imvume nanini na kwiziko lakho labucala."
- next: "Nika imvume uqhubeke"
- purposes.searchability: "Ukukhangeleka" · contact_reveal: "Ukuvezwa koqhagamshelwano" · document_sharing: "Ukwabelana ngamaxwebhu" · analytics_aggregate: "Amanani adityanisiweyo" · outcomes_research: "Uphando lweziphumo" · vacancy_matching: "Izimemo zezithuba"
- purposeDetails.searchability: "Vumela abaqeshi bandifumane ngesakhono nangendawo."
- purposeDetails.contact_reveal: "Abaqeshi abaqinisekisiweyo bangacela iinkcukacha zam zoqhagamshelwano. Konke ukuvezwa kuyarekhodwa."
- purposeDetails.document_sharing: "Abaqeshi abaqinisekisiweyo bangacela iziqinisekiso zam endizilayishileyo."
- purposeDetails.analytics_aggregate: "Ndibale kumanani engqesho esizwe. Akukho datha yam yabelwanayo."
- purposeDetails.outcomes_research: "Ndifake kumanani eqela asuka kwimfundo aye kwingqesho. Akaze aveze mntu."
- purposeDetails.vacancy_matching: "Abaqeshi abaqinisekisiweyo bangandiphawulela isithuba esithile esinegama."
- groups.employers: "Abanokukwenza abaqeshi" · groups.employersHint: "Zontathu ziyazikhethelwa. Konke ukufikelela kokwabaqeshi abaqinisekisiweyo kuphela kwaye kuyarekhodwa."
- groups.statistics: "Ndibale kumanani esizwe" · groups.statisticsHint: "Okuzikhethelayo. Kudityanisiwe kuphela. Akuze kukuveze."
- required: "Iyafuneka ukuze iprofayile yakho ivele kwiziphumo zokhangelo."
- terms.agreePrefix: "Ndiyavuma" · terms.termsLink: "iMigqaliselo yeNkonzo" · terms.and: "kunye" · terms.privacyLink: "uMgaqo-nkqubo waBucala"
- terms.hint: "IMigqaliselo iquka iakhawunti yakho nokusetyenziswa okwamkelekileyo. Ukhetho lwemvume olungentla luhlala lunokurhoxiswa ngalunye kwiziko lakho labucala."

### Afrikaans draft

- heading: "Jou toestemming maak saak"
- subhead: "Jou profiel is nie soekbaar voordat jy sê dit mag wees nie. Jy kan enige toestemming te eniger tyd in jou privaatheidsentrum herroep."
- next: "Gee toestemming en gaan voort"
- purposes.searchability: "Soekbaarheid" · contact_reveal: "Kontakonthulling" · document_sharing: "Dokumentdeling" · analytics_aggregate: "Saamgestelde statistiek" · outcomes_research: "Uitkomsnavorsing" · vacancy_matching: "Vakature-uitnodigings"
- purposeDetails.searchability: "Laat werkgewers my volgens vaardigheid en ligging vind."
- purposeDetails.contact_reveal: "Geverifieerde werkgewers kan my kontakbesonderhede versoek. Elke onthulling word aangeteken."
- purposeDetails.document_sharing: "Geverifieerde werkgewers kan my opgelaaide kwalifikasies versoek."
- purposeDetails.analytics_aggregate: "Tel my in nasionale indiensnemingstatistiek. Geen persoonlike data word gedeel nie."
- purposeDetails.outcomes_research: "Sluit my in by kohortvlak onderwys-tot-werk-statistiek. Identifiseer nooit enige individu nie."
- purposeDetails.vacancy_matching: "Geverifieerde werkgewers kan my vir 'n spesifieke benoemde rol merk."
- groups.employers: "Wat werkgewers mag doen" · groups.employersHint: "Al drie is opsioneel. Elke toegang is slegs vir geverifieerde werkgewers en word aangeteken."
- groups.statistics: "Tel my in nasionale statistiek" · groups.statisticsHint: "Opsioneel. Slegs saamgestel. Identifiseer jou nooit nie."
- required: "Vereis sodat jou profiel in soekresultate verskyn."
- terms.agreePrefix: "Ek stem in tot die" · terms.termsLink: "Diensbepalings" · terms.and: "en" · terms.privacyLink: "Privaatheidsbeleid"
- terms.hint: "Die Bepalings dek jou rekening en aanvaarbare gebruik. Die toestemmingskeuses hierbo bly afsonderlik herroepbaar in jou privaatheidsentrum."

## 2 · The privacy centre (`seekerDash.privacy`)

### isiZulu draft

- title: "Ubumfihlo nemvume" · subtitle: "Wena olawula lokho uSebenza angakwenza ngedatha yakho. Hoxisa noma iyiphi imvume engezansi noma nini."
- consents: "Izimvume ezisebenzayo" · noConsent: "Azikho izimvume ezisebenzayo. Iphrofayela yakho ayisesheki."
- revoke: "Hoxisa" · granted: "Kunikezwe {date}" · version: "Inguqulo {v}" · yourData: "Idatha yakho"
- exportTitle: "Khipha konke enginakho kuSebenza"
- exportBody: "Sizokwakha ifayela le-JSON elinephrofayela yakho, isipiliyoni, iziqu, izimvume nelogu yokuhlola. Lithunyelwa ku-imeyili yakho ebhalisiwe zingakapheli izinsuku ezingama-30 (isigaba 23 se-POPIA)."
- exportCta: "Cela ukukhishwa kwedatha"
- deleteTitle: "Sula i-akhawunti yami"
- deleteBody: "Kususa iphrofayela yakho ngokushesha (ayisesheki). Kusebenza isikhathi somusa sezinsuku ezingama-30. Emva kwalokho sisula unomphela. Amalogu okuhlola agcinwa engenamagama, njengoba i-POPIA ifuna."
- deleteCta: "Cela ukusulwa"

### isiXhosa draft

- title: "Ubumfihlo nemvume" · subtitle: "Nguwe olawula oko uSebenza anokukwenza ngedatha yakho. Rhoxisa nayiphi na imvume engezantsi nanini na."
- consents: "Iimvume ezisebenzayo" · noConsent: "Akukho zimvume zisebenzayo. Iprofayile yakho ayikhangeleki."
- revoke: "Rhoxisa" · granted: "Inikwe {date}" · version: "Inguqulelo {v}" · yourData: "Idatha yakho"
- exportTitle: "Khupha konke endinako kuSebenza"
- exportBody: "Siza kwenza ifayile ye-JSON eneprofayile yakho, amava, iziqinisekiso, iimvume nelog yophicotho. Ithunyelwa kwi-imeyile yakho ebhalisiweyo kungekapheli iintsuku ezingama-30 (icandelo 23 le-POPIA)."
- exportCta: "Cela ukukhutshwa kwedatha"
- deleteTitle: "Cima iakhawunti yam"
- deleteBody: "Isusa iprofayile yakho ngoko nangoko (ayisakhangeleki). Kusebenza ithuba lesisa leentsuku ezingama-30. Emva koko sicima ngokupheleleyo. Iilog zophicotho zigcinwa zingenagama, njengoko i-POPIA ifuna."
- deleteCta: "Cela ukucinywa"

### Afrikaans draft

- title: "Privaatheid en toestemming" · subtitle: "Jy beheer wat Sebenza met jou data kan doen. Herroep enige toestemming hieronder te eniger tyd."
- consents: "Aktiewe toestemmings" · noConsent: "Geen aktiewe toestemmings nie. Jou profiel is nie soekbaar nie."
- revoke: "Herroep" · granted: "Toegestaan {date}" · version: "Weergawe {v}" · yourData: "Jou data"
- exportTitle: "Voer alles uit wat ek op Sebenza het"
- exportBody: "Ons genereer 'n JSON-lêer met jou profiel, ervaring, kwalifikasies, toestemmings en ouditlog. Dit word binne 30 dae by jou geregistreerde e-pos afgelewer (POPIA artikel 23)."
- exportCta: "Versoek data-uitvoer"
- deleteTitle: "Vee my rekening uit"
- deleteBody: "Verwyder jou profiel onmiddellik (nie meer soekbaar nie). 'n Grasieperiode van 30 dae geld. Daarna vee ons dit permanent uit. Ouditlogs word geanonimiseer bewaar, soos POPIA vereis."
- deleteCta: "Versoek uitvee"

## 3 · The ID-encryption hints

`auth.seekerSignUp.stepHints.id`:
- **zu:** "Sizoyibethela ngokushesha. Ayilokothi iboniswe futhi, ngisho nakuwe, ngisho nakubaphathi."
- **xh:** "Siza kuyibethela ngoko nangoko. Ayize iboniswe kwakhona, nkqu nakuwe, nkqu nakubalawuli."
- **af:** "Ons enkripteer dit onmiddellik. Dit word nooit weer vertoon nie, selfs nie vir jou nie, selfs nie vir administrateurs nie."

`seekerDash.profileEditor.fields.nationalIdHelp`:
- **zu:** "Ibethelwa nge-AES-256-GCM ngomzuzu oyilondoloza ngawo. Ayilokothi iboniswe futhi. Isetshenziselwa ukuqinisekisa kuphela. Ayilokothi yabiwe."
- **xh:** "Ibethelwa nge-AES-256-GCM ngomzuzwana oyigcina ngawo. Ayize iboniswe kwakhona. Isetyenziselwa ukuqinisekisa kuphela. Ayize yabelwane."
- **af:** "Word met AES-256-GCM geënkripteer die oomblik wat jy stoor. Word nooit weer vertoon nie. Slegs vir verifikasie gebruik. Word nooit gedeel nie."

---

## VERIFY (done when the reviewer signs off)

- [ ] Reviewer has been through all three catalogs and corrected in place.
- [ ] Reviewer has approved (or corrected) the consent/legal drafts above.
- [ ] Approved consent blocks pasted into the three catalogs; `CONSENT_HOLD_PREFIXES` emptied
      in `lib/i18n/catalogs.test.ts`; `npm run test` green.
- [ ] Marketing "four languages" claims and video V9 unblocked.
