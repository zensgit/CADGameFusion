#include "core/solver.hpp"
#include <cmath>
#include <iostream>
#include <Eigen/Dense>

namespace core {

class MinimalSolver : public ISolver {
    int maxIters_ = 50;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    // NOTE: This is a stub that only evaluates residuals without modifying vars.
    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        // Legacy stub
        SolveResult r; r.ok = true; r.iterations = 0; r.finalError = 0.0;
        r.message = "Converged (no-op stub)";
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

        const size_t n = vars.size();
        const size_t m = constraints.size();
        if (n == 0 || m == 0) {
             SolveResult out; out.ok = true; out.iterations = 0; out.finalError = 0.0; return out;
        }

        // Current values snapshot
        Eigen::VectorXd x(n);
        for (size_t j=0;j<n;j++){ bool okv=false; x[j]=get(vars[j], okv); }

        auto write_x = [&](const Eigen::VectorXd& currX){ for (size_t j=0;j<n;j++) set(vars[j], currX[j]); };

        // Error norm function
        auto eval_norm = [&](){ double n=0.0; for (const auto& c: constraints){ bool okc=false; double rr=residual(c, okc); n += rr*rr; } return std::sqrt(n); };

        write_x(x);
        double prev = eval_norm();
        int it = 0;
        double lambda = 1e-3; // damping

        // Levenberg-Marquardt
        for (; it < maxIters_; ++it) {
            // 1. Residual vector
            Eigen::VectorXd rvec(m);
            for (size_t i=0; i<m; ++i) { bool okc=false; rvec[i] = residual(constraints[i], okc); }

            // 2. Jacobian J (m x n)
            Eigen::MatrixXd J(m, n);
            const double eps = 1e-6;
            for (size_t j=0; j<n; ++j) {
                double xj = x[j];
                set(vars[j], xj + eps); // Perturb
                for (size_t i=0; i<m; ++i) {
                    bool okc=false;
                    double r2 = residual(constraints[i], okc);
                    J(i, j) = (r2 - rvec[i]) / eps;
                }
                set(vars[j], xj); // Restore
            }

            // 3. Normal Equations: (J^T J + lambda I) delta = -J^T r
            Eigen::MatrixXd A = J.transpose() * J;
            A.diagonal().array() += lambda;
            Eigen::VectorXd b = -J.transpose() * rvec;

            // Solve using LDLT (fast for symmetric positive definite)
            // Or ColPivHouseholderQR for robustness if rank deficient
            Eigen::VectorXd delta = A.ldlt().solve(b);

            // 4. Update and check
            Eigen::VectorXd newX = x + delta;
            write_x(newX);
            double newNorm = eval_norm();

            if (newNorm < prev) {
                // Accept step
                x = newX;
                prev = newNorm;
                lambda = std::max(1e-10, lambda * 0.1);
            } else {
                // Reject step
                write_x(x); // Reset world
                lambda *= 10.0;
            }

            if (prev <= tol_) break;
        }

        write_x(x);
        SolveResult out; 
        out.ok = (prev <= tol_); 
        out.iterations = it; 
        out.finalError = prev;
        out.message = (out.ok ? "Converged (Eigen LM)" : "Stopped (max iters or stagnation)");
        return out;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

} // namespace core