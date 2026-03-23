// Busca las variables searchParams en la parte superior de tu función principal
  const businessId = searchParams.businessId || "all";
  const preset = searchParams.range || "30d";
  const from = searchParams.from; // <--- AGREGA ESTO
  const to = searchParams.to;     // <--- AGREGA ESTO

  // Y donde se hace la llamada a la base de datos, cámbialo a esto:
  const dashboardData = await getOwnerSalesDashboard({
    businessId: businessId === "all" ? null : businessId,
    preset: preset as any,
    from: from as string | undefined,
    to: to as string | undefined,
  });