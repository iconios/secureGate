import { Router } from "express";
import { getAllNonPrincipalResidentsByEstateController } from "./get_nonPrincipal_residents/get_nonPrincipal_residents_controller.js";

export const residentsRouter = Router();

residentsRouter.get('/non-principals/by-estate', getAllNonPrincipalResidentsByEstateController);