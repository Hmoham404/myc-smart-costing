import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Feed from './pages/Feed'
import Calculator from './pages/Calculator'
import Simulator from './pages/Simulator'
import Products from './pages/Products'
import Parameters from './pages/Parameters'
import Quotes from './pages/Quotes'
import QuoteEditor from './pages/QuoteEditor'
import Samples from './pages/Samples'
import Assistant from './pages/Assistant'
import History from './pages/History'
import Team from './pages/Team'
import Dashboard from './pages/Dashboard'
import WhatIf from './pages/WhatIf'
import Goals from './pages/Goals'
import Pieces3D from './pages/Pieces3D'
import Paint from './pages/Paint'
import Projects from './pages/Projects'
import ProjectView from './pages/ProjectView'
import ProjectsHome from './pages/ProjectsHome'
import WorkspaceChooser from './pages/WorkspaceChooser'

export default function App() {
  const { profile, loading, workspace } = useApp()
  if (loading) return <div className="splash"><img src="/logo-myc-dark.png" alt="MYC" /></div>
  if (!profile) return <Login />
  if (!workspace) return <WorkspaceChooser />
  // Espace Projets (Seif) : uniquement ses projets
  if (workspace === 'projects') {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectsHome />} />
          <Route path="/projets" element={<Projects />} />
          <Route path="/projets/:id" element={<ProjectView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    )
  }
  // Espace Métallisation (Slah)
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analyse" element={<WhatIf />} />
        <Route path="/objectifs" element={<Goals />} />
        <Route path="/activite" element={<Feed />} />
        <Route path="/calculateur" element={<Calculator />} />
        <Route path="/simulateur" element={<Simulator />} />
        <Route path="/produits" element={<Products />} />
        <Route path="/pieces-3d" element={<Pieces3D />} />
        <Route path="/peinture" element={<Paint />} />
        <Route path="/parametres" element={<Parameters />} />
        <Route path="/devis" element={<Quotes />} />
        <Route path="/devis/:id" element={<QuoteEditor />} />
        <Route path="/echantillons" element={<Samples />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/historique" element={<History />} />
        <Route path="/equipe" element={<Team />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  )
}
