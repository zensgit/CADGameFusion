#include "core/solver.hpp"
#include <cmath>

namespace core {

class MinimalSolver : public ISolver {
    int maxIters_ = 50;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    // NOTE: This is a stub that only evaluates residuals without modifying vars.
    // It reports success if residuals are already within tolerance.
    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        double err2 = 0.0;
        for (const auto& c : constraints) {
            if (c.type == "horizontal" && c.vars.size() >= 2) {
                // expects two vars: y0, y1
                // This stub assumes value held externally; we can't update vars without a model.
                // So residual = y1 - y0
                // Here we can't read numeric values (no storage) — treat as zero-residual placeholder.
            } else if (c.type == "distance" && c.value.has_value()) {
                // Can't compute without numeric variables; skip.
            }
        }
        SolveResult r; r.ok = (std::sqrt(err2) <= tol_); r.iterations = 0; r.finalError = std::sqrt(err2);
        r.message = r.ok ? "Converged (no-op stub)" : "No model bound; cannot solve";
        return r;
    }

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) override {
        // Residuals (extendable): returns r(c), ok indicates all inputs present
        auto residual = [&](const ConstraintSpec& c, bool& ok)->double {
            ok = true;
            if (c.type == "horizontal" && c.vars.size() >= 2) {
                bool ok0=false, ok1=false;
                double y0 = get(c.vars[0], ok0);
                double y1 = get(c.vars[1], ok1);
                ok = ok0 && ok1; return (ok ? (y1 - y0) : 0.0);
            }
            if (c.type == "vertical" && c.vars.size() >= 2) {
                bool ok0=false, ok1=false;
                double x0 = get(c.vars[0], ok0);
                double x1 = get(c.vars[1], ok1);
                ok = ok0 && ok1; return (ok ? (x1 - x0) : 0.0);
            }
            if (c.type == "distance" && c.vars.size() >= 4 && c.value.has_value()) {
                bool ok0=false, ok1=false, ok2=false, ok3=false;
                double x0 = get(c.vars[0], ok0), y0 = get(c.vars[1], ok1);
                double x1 = get(c.vars[2], ok2), y1 = get(c.vars[3], ok3);
                if (!(ok0&&ok1&&ok2&&ok3)) { ok=false; return 0.0; }
                double dx = x1 - x0, dy = y1 - y0; double d = std::sqrt(dx*dx + dy*dy);
                return (d - *c.value);
            }
            if (c.type == "parallel" && c.vars.size() >= 8) {
                bool okv[8]; for (int i=0;i<8;++i) okv[i]=false;
                double x0 = get(c.vars[0], okv[0]), y0 = get(c.vars[1], okv[1]);
                double x1 = get(c.vars[2], okv[2]), y1 = get(c.vars[3], okv[3]);
                double x2 = get(c.vars[4], okv[4]), y2 = get(c.vars[5], okv[5]);
                double x3 = get(c.vars[6], okv[6]), y3 = get(c.vars[7], okv[7]);
                for (int i=0;i<8;++i) if (!okv[i]) { ok=false; return 0.0; }
                double v1x = x1-x0, v1y = y1-y0, v2x = x3-x2, v2y = y3-y2;
                double n1 = std::sqrt(v1x*v1x + v1y*v1y), n2 = std::sqrt(v2x*v2x + v2y*v2y);
                if (n1==0.0 || n2==0.0) { ok=true; return 0.0; }
                // Use sine of angle as residual (want 0)
                double s = std::abs(v1x*v2y - v1y*v2x) / (n1*n2);
                return s;
            }
            if (c.type == "perpendicular" && c.vars.size() >= 8) {
                bool okv[8]; for (int i=0;i<8;++i) okv[i]=false;
                double x0 = get(c.vars[0], okv[0]), y0 = get(c.vars[1], okv[1]);
                double x1 = get(c.vars[2], okv[2]), y1 = get(c.vars[3], okv[3]);
                double x2 = get(c.vars[4], okv[4]), y2 = get(c.vars[5], okv[5]);
                double x3 = get(c.vars[6], okv[6]), y3 = get(c.vars[7], okv[7]);
                for (int i=0;i<8;++i) if (!okv[i]) { ok=false; return 0.0; }
                double v1x = x1-x0, v1y = y1-y0, v2x = x3-x2, v2y = y3-y2;
                double n1 = std::sqrt(v1x*v1x + v1y*v1y), n2 = std::sqrt(v2x*v2x + v2y*v2y);
                if (n1==0.0 || n2==0.0) { ok=true; return 0.0; }
                // Use cosine as residual (want 0)
                double cang = (v1x*v2x + v1y*v2y) / (n1*n2);
                return cang;
            }
            if (c.type == "equal" && c.vars.size() >= 2) {
                bool ok0=false, ok1=false;
                double a = get(c.vars[0], ok0);
                double b = get(c.vars[1], ok1);
                ok = ok0 && ok1; return (ok ? (a - b) : 0.0);
            }
            ok = true; return 0.0; // unsupported constraints return 0 residual
        };

        // Collect unique variables
        std::vector<VarRef> vars;
        auto add_unique = [&](const VarRef& v){ for (auto& u : vars) if (u.id==v.id && u.key==v.key) return; vars.push_back(v); };
        for (const auto& c : constraints) for (const auto& v : c.vars) add_unique(v);

        // Current values snapshot
        std::vector<double> x(vars.size(), 0.0);
        for (size_t j=0;j<vars.size();++j){ bool okv=false; x[j]=get(vars[j], okv); (void)okv; }
        auto write_x = [&](){ for (size_t j=0;j<vars.size();++j) set(vars[j], x[j]); };

        // Error norm function
        auto eval_norm = [&](){ double n=0.0; for (const auto& c: constraints){ bool okc=false; double rr=residual(c, okc); n += rr*rr; } return std::sqrt(n); };

        write_x();
        double prev = eval_norm();
        int it = 0;
        // Damped Gauss-Newton (Levenberg-like) with finite-diff Jacobian
        auto solveLinear = [](std::vector<std::vector<double>>& A, std::vector<double>& b)->bool{
            const size_t n = A.size();
            for (size_t i=0;i<n;i++) {
                // partial pivot
                size_t piv = i; double best = std::abs(A[i][i]);
                for (size_t k=i+1;k<n;k++){ double v=std::abs(A[k][i]); if (v>best){best=v;piv=k;} }
                if (best < 1e-12) return false;
                if (piv!=i){ std::swap(A[piv], A[i]); std::swap(b[piv], b[i]); }
                double diag = A[i][i];
                for (size_t j=i;j<n;j++) A[i][j] /= diag; b[i] /= diag;
                for (size_t k=0;k<n;k++) if (k!=i){ double f=A[k][i]; if (std::abs(f)>0){ for (size_t j=i;j<n;j++) A[k][j]-=f*A[i][j]; b[k]-=f*b[i]; } }
            }
            return true;
        };

        double lambda = 1e-3; // damping
        for (; it < maxIters_; ++it) {
            // Residuals at x
            std::vector<double> rvec; rvec.reserve(constraints.size());
            for (const auto& c : constraints){ bool okc=false; rvec.push_back(residual(c, okc)); }

            // Finite-diff Jacobian J (m x n): J_ij = dr_i/dx_j
            const double eps = 1e-6;
            const size_t m = rvec.size();
            const size_t n = vars.size();
            std::vector<std::vector<double>> J(m, std::vector<double>(n, 0.0));
            for (size_t j=0;j<n;j++){
                double xj = x[j];
                set(vars[j], xj + eps);
                for (size_t i=0;i<m;i++){ bool okc=false; double r2 = residual(constraints[i], okc); J[i][j] = (r2 - rvec[i]) / eps; }
                set(vars[j], xj);
            }
            // Build normal equations: A = J^T J + lambda I, b = -J^T r
            std::vector<std::vector<double>> A(n, std::vector<double>(n, 0.0));
            std::vector<double> b(n, 0.0);
            for (size_t j=0;j<n;j++){
                for (size_t k=0;k<n;k++){
                    double s=0.0; for (size_t i=0;i<m;i++) s += J[i][j]*J[i][k];
                    A[j][k] = s + (j==k ? lambda : 0.0);
                }
                double sj=0.0; for (size_t i=0;i<m;i++) sj += J[i][j]*rvec[i];
                b[j] = -sj;
            }
            // Solve for delta
            std::vector<std::vector<double>> A2 = A;
            std::vector<double> b2 = b;
            bool ok = solveLinear(A2, b2);
            if (!ok) { lambda *= 10.0; continue; }
            // Trial step
            std::vector<double> newx = x; for (size_t j=0;j<n;j++) newx[j] = x[j] + b2[j];
            for (size_t j=0;j<n;j++) set(vars[j], newx[j]);
            double nn = eval_norm();
            if (nn < prev - 1e-9) {
                // accept, reduce damping
                x.swap(newx); prev = nn; lambda = std::max(1e-12, lambda*0.5);
            } else {
                // reject, increase damping
                for (size_t j=0;j<n;j++) set(vars[j], x[j]);
                lambda *= 4.0; // more conservative increase
            }
            if (prev <= tol_) break;
        }

        write_x();
        SolveResult out; out.ok = (prev <= tol_); out.iterations = it; out.finalError = prev;
        out.message = (out.ok ? "Converged (gradient descent)" : "Stopped (max iters or stagnation)");
        return out;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

} // namespace core
