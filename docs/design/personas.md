# Proto-Personas

Lightweight personas based on common genealogy user archetypes. No formal interviews — derived from competitive analysis, genealogy community patterns, and target user understanding.

---

## 1. Margaret, the Dedicated Researcher (Primary)

**Demographics:** Age 55-70, retired teacher/librarian, suburban US
**Tech comfort:** Moderate — uses desktop apps, email, social media; not command-line

**Background:**
- Has been researching family history for 10+ years
- Maintains trees on Ancestry.com and FamilySearch
- Has multiple GEDCOM files from different sources
- Member of local genealogy society
- Spends 10-15 hours/week on genealogy research

**Goals:**
- Own her data without subscription lock-in
- Merge research from multiple sources into one authoritative tree
- Properly cite every fact with source documentation
- Share specific branches with cousins while keeping living persons private
- Search free record databases without paying Ancestry's subscription

**Needs:**
- GEDCOM import that handles her Ancestry/FamilySearch files cleanly
- Source citation management (she's meticulous about documentation)
- Genealogical date handling (about, before, after — not just exact dates)
- Multiple name variants per person (maiden names, married names, AKAs)
- Privacy controls for living relatives
- Data export for backup and sharing

**Pain points:**
- Ancestry's $300+/year subscription for record access
- Data locked in proprietary platforms
- Inconsistent records across sources
- Losing research when platforms change or shut down
- Can't easily share trees without exposing living relatives
- Complex software that requires training (Gramps)

**Key scenarios:**
- Imports a 2,000-person GEDCOM from Ancestry
- Adds source citations to events she's verified
- Exports a privacy-filtered tree to share with a cousin
- Searches for a great-grandmother's immigration record

---

## 2. Alex, the Family Historian (Secondary)

**Demographics:** Age 30-45, working professional, tech-savvy parent
**Tech comfort:** High — web-native, mobile-first expectations, comfortable with modern apps

**Background:**
- Wants to document family stories before grandparents pass
- Has scattered notes, a few photos, some names from conversations
- Starting with a small tree (20-50 people)
- Motivated by desire to create something lasting for their kids
- Occasional researcher (2-3 hours/week when motivated)

**Goals:**
- Build a beautiful family tree to show at family gatherings
- Easy, quick data entry without overwhelming complexity
- Attach photos and stories to people
- Share the tree with extended family members
- Eventually connect with distant relatives

**Needs:**
- Simple person entry (don't need all genealogy fields upfront)
- Visual tree that's attractive and easy to navigate
- "Add relative" flow that's contextual and intuitive
- Mobile-friendly for entering data during family visits
- Clear guidance on what to fill in (progressive disclosure)

**Pain points:**
- Overwhelmed by genealogy software complexity (too many fields)
- Doesn't know genealogy terminology
- Existing tools feel dated/ugly
- Can't easily show tree to non-tech family members
- Unclear what information matters most to capture

**Key scenarios:**
- Adds their immediate family from scratch (parents, grandparents, siblings)
- Adds a spouse's parent from the tree view ("Add Father")
- Shows the pedigree chart to parents at a family dinner
- Enters birth/death info they learned from a conversation with grandma

---

## 3. Jordan, the Casual Explorer (Tertiary)

**Demographics:** Age 20-35, recent college grad or young professional
**Tech comfort:** Very high — expects modern web app UX, uses apps on phone primarily

**Background:**
- Got curious about heritage after taking a DNA test (23andMe/AncestryDNA)
- Knows a few names from grandparents but no structured tree
- Wants quick, interesting discoveries about their background
- Short attention span for genealogy — needs quick wins
- Might share interesting findings on social media

**Goals:**
- Quickly see a visual representation of known family
- Discover interesting facts or connections
- Understand heritage/ethnicity context
- Show friends/family something cool
- Maybe get deeper into genealogy if the experience is good

**Needs:**
- Empty-state experience that guides them to start
- Quick setup — add first person in under 2 minutes
- Visual, engaging tree (not a boring data table)
- AI-powered suggestions and discoveries (Phase 2+)
- Mobile-first experience

**Pain points:**
- Genealogy apps feel like they're made for retirees
- Too much jargon (GEDCOM, probate, naturalization)
- No idea where to start or what information to enter
- Wants instant gratification, not months of research
- Existing tools require desktop, not mobile-friendly

**Key scenarios:**
- Opens app for first time, guided to add self + parents
- Sees a small but visually appealing 3-generation tree
- Adds grandparents' names from memory
- Explores tree visualization, zooming and panning

---

## Persona Priority Matrix

| Feature Area | Margaret (Primary) | Alex (Secondary) | Jordan (Tertiary) |
|-------------|-------------------|------------------|-------------------|
| Person CRUD | Power user, all fields | Simple entry, basics first | Minimal, guided |
| GEDCOM Import | Critical (migration) | Not needed initially | Not relevant |
| Tree Visualization | Functional, data-rich | Beautiful, shareable | Engaging, visual |
| Source Citations | Essential (research) | Nice to have | Not interested |
| Search & Filter | Power search | Basic search | Not needed yet |
| Privacy Controls | Critical (sharing) | Important (family) | Not concerned |
| Mobile Experience | Secondary (desktop) | Important (family visits) | Primary device |
| AI Features (Phase 2+) | Research assistant | Smart suggestions | Discovery engine |

## Design Implications

1. **Progressive disclosure is essential** — Margaret needs all the fields, but they should be hidden by default so Alex and Jordan aren't overwhelmed
2. **Two entry paths** — Quick add (name + dates + sex) for Alex/Jordan, Full form (all fields + sources) for Margaret
3. **Visual tree is the hero feature** — All personas want to see/show their tree; it must be beautiful and interactive
4. **GEDCOM import is Day 1 critical** for Margaret but irrelevant to others — prominent but not forced
5. **Mobile-viable** — Alex uses it at family gatherings, Jordan uses it on phone; desktop-first but responsive
6. **Onboarding differs by persona** — empty state should offer both "Import GEDCOM" (Margaret) and "Add your first person" (Alex/Jordan)
