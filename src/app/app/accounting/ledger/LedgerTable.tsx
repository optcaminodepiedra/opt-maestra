"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingDown, Search, Filter } from "lucide-react";

export default function LedgerTable({ data }: { data: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");

  // Lógica para filtrar en tiempo real
  const filteredData = data.filter(tx => {
    const matchesSearch = 
      tx.concept.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.userName.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = filterType === "ALL" || tx.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        
        {/* BARRA DE HERRAMIENTAS (Buscador y Filtros) */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar concepto, sucursal o usuario..." 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            <Button 
              variant={filterType === "ALL" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilterType("ALL")}
            >
              Todos
            </Button>
            <Button 
              variant={filterType === "INCOME" ? "default" : "outline"} 
              size="sm" 
              className={filterType === "INCOME" ? "bg-green-600 hover:bg-green-700 text-white" : "text-green-700"}
              onClick={() => setFilterType("INCOME")}
            >
              <DollarSign className="w-4 h-4 mr-1"/> Ingresos
            </Button>
            <Button 
              variant={filterType === "EXPENSE" ? "default" : "outline"} 
              size="sm" 
              className={filterType === "EXPENSE" ? "bg-red-600 hover:bg-red-700 text-white" : "text-red-700"}
              onClick={() => setFilterType("EXPENSE")}
            >
              <TrendingDown className="w-4 h-4 mr-1"/> Egresos
            </Button>
          </div>
        </div>

        {/* TABLA DE MOVIMIENTOS */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Concepto</th>
                <th className="px-6 py-4 font-medium">Sucursal / Usuario</th>
                <th className="px-6 py-4 font-medium">Fecha</th>
                <th className="px-6 py-4 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredData.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                  
                  {/* CONCEPTO Y TIPO */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full shrink-0 ${tx.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {tx.type === 'INCOME' 
                          ? <DollarSign className="h-4 w-4 text-green-600" /> 
                          : <TrendingDown className="h-4 w-4 text-red-600" />
                        }
                      </div>
                      <div>
                        <div className="font-semibold capitalize text-base">{tx.concept}</div>
                        {tx.status === "PENDING" && (
                          <Badge variant="outline" className="text-[10px] h-4 mt-1 bg-amber-50 text-amber-700 border-amber-200">Sin Ticket</Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* SUCURSAL Y USUARIO */}
                  <td className="px-6 py-4">
                    <div className="font-medium">{tx.businessName}</div>
                    <div className="text-xs text-muted-foreground">{tx.userName}</div>
                  </td>
                  
                  {/* FECHA */}
                  <td className="px-6 py-4 text-muted-foreground">
                    {formatDate(tx.date)}
                  </td>

                  {/* MONTO */}
                  <td className="px-6 py-4 text-right">
                    <div className={`font-bold text-lg ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatMoney(tx.amount)}
                    </div>
                  </td>
                  
                </tr>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-lg">
                    No se encontraron transacciones con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}