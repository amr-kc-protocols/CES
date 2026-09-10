import { useSearchParams } from 'react-router-dom'
import type { AemtStudent } from '../../types'

// ---------------------------------------------------------------------------
// Which student the course view is looking at.
//
// Skills, Clinical and Forms each kept their own selection in component state,
// each defaulting to the first name on the roster. Two things followed, and
// both were reported as "the app lost my place":
//
//  * Working one student end to end — check them off on Skills, then log the
//    reps on Clinical — meant re-picking them on arrival at every tab, because
//    the tab that just mounted had never heard of the choice made next door.
//  * Worse, it did not announce the reset. A tab switch silently put you on
//    whoever sorts first, and the next thing typed was filed against them. On
//    a certification record that is not a nuisance, it is a wrong entry that
//    someone has to notice and void.
//
// The tab already lives in the URL "so a refresh keeps your place and tabs are
// linkable" — the student belongs there for exactly the same reasons, and the
// URL is the one piece of state every tab can see. An id that is not on this
// roster (a stale link, a removed student) falls back to the first name rather
// than rendering an empty screen.
// ---------------------------------------------------------------------------

/**
 * The selected student and a setter that writes it to `?student=`.
 *
 * Callers must handle an empty roster themselves — every tab already does,
 * with an empty state that points at Roster.
 */
export function useSelectedStudent(
  students: AemtStudent[],
): [AemtStudent | undefined, (id: string) => void] {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('student')
  const student = students.find((s) => s.id === wanted) ?? students[0]

  const select = (id: string) => {
    // Merge rather than replace: the tab is a sibling parameter and setting
    // one must never drop the other.
    const next = new URLSearchParams(params)
    if (id) next.set('student', id)
    else next.delete('student')
    setParams(next, { replace: true })
  }

  return [student, select]
}
