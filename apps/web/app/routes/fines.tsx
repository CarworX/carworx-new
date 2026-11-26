/**
 * /fines: the fines band lives on the landing (/#fines). This page only sends
 * people there, so the old fines copy is gone from this route.
 */
import { throwRedirect } from "../auth/http.server";

export function loader() {
  throwRedirect("/#fines");
}
